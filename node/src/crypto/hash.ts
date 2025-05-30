/* eslint-disable @typescript-eslint/no-namespace, no-inner-declarations */

import * as crypto from "node:crypto";
import { LogarithmicArray } from "array-t";
import type { BufferLike } from "@rapid-d-kit/types";
import { IDisposable } from "@rapid-d-kit/disposable";
import { Readable as ReadableStream } from "node:stream";
import { Readable as ReadableSource } from "ndforge/stream";
import { CancellationToken, ICancellationToken } from "@rapid-d-kit/async";

import { consumeBuffer } from "./util";
import { array } from "../@internals/util";
import { HyChainException } from "../errors";
import { jsonSafeStringify } from "../@internals/safe-json";
import { BufferReader, BufferWriter, chunkToBuffer, IReader } from "../@internals/binary-protocol";


export class HashEntity implements IDisposable {
  readonly #content: BufferReader;
  readonly #state = { disposed: false };

  public constructor(source: BufferLike) {
    this.#content = new BufferReader(chunkToBuffer(source));
  }

  public get byteLength(): number {
    this.#EnsureNotDisposed();
    return this.#content.byteLength;
  }

  public equals(other: HashEntity | BufferLike): boolean {
    this.#EnsureNotDisposed();

    if(!(other instanceof HashEntity)) {
      other = new HashEntity(chunkToBuffer(other));
    }

    other.#EnsureNotDisposed();
    return other.#content.buffer.equals(this.#content.buffer);
  }

  public digest(encoding: crypto.BinaryToTextEncoding): string {
    this.#EnsureNotDisposed();
    return this.#content.read().toString(encoding);
  }

  public bytes(): Uint8Array {
    this.#EnsureNotDisposed();
    return new Uint8Array(this.#content.read().toJSON().data);
  }

  public buffer(): Buffer {
    this.#EnsureNotDisposed();
    return this.#content.read();
  }

  public arrayBuffer(): ArrayBuffer {
    this.#EnsureNotDisposed();
    
    const buffer = new ArrayBuffer(this.#content.byteLength);
    
    new Uint8Array(buffer)
      .set(this.#content.read());
    
    return buffer;
  }

  public read(length?: number | undefined): Buffer {
    this.#EnsureNotDisposed();
    return this.#content.read(length);
  }

  public dispose(): void {
    if(!this.#state.disposed) {
      this.#content.dispose();
      this.#state.disposed = true;
    }
  }

  #EnsureNotDisposed(): void {
    if(this.#state.disposed) {
      throw new HyChainException("Hash entity is already disposed and cannot be used anymore", "ERR_RESOURCE_DISPOSED");
    }
  }
}


export namespace MerkleTree {
  export function serializePayload<T>(payload: T): Buffer {
    const data = jsonSafeStringify(payload);

    if(data.isLeft()) {
      throw data.value;
    }

    return Buffer.from(data.value);
  }

  export async function computeRoot(hashes: readonly BufferLike[] | LogarithmicArray<BufferLike>): Promise<HashEntity> {
    const hashesList = array("log", hashes);

    if(hashesList.size() < 1)
      return await hashData("");

    let level = hashesList.map(chunkToBuffer);
  
    while(level.size() > 1) {
      const hashTasks: Promise<Buffer>[] = [];
      const nextLevel: LogarithmicArray<Buffer> = new LogarithmicArray(80);

      for(let i = 0; i < level.size(); i += 2) {
        const left = level.get(i);
        const right = level.findByIndex(i + 1) ?? left;

        const task = async () => {
          const combinedHash = await hashData(Buffer.concat([left, right]));
          return combinedHash.buffer();
        };

        hashTasks.push(task());
      }

      nextLevel.push(...(await Promise.all(hashTasks)));
      level = nextLevel;
    }

    return new HashEntity(level.get(0));
  }

  export async function createRoot<T>(payload: T): Promise<HashEntity> {
    const data = serializePayload(payload);
    
    const chunkSize = 1024;
    const chunks: LogarithmicArray<Buffer> = new LogarithmicArray(80);

    for(let i = 0; i < data.length; i += chunkSize) {
      chunks.push(data.subarray(i, i + chunkSize));
    }

    if(chunks.size() === 0) {
      chunks.push(data);
    }

    const leftHashes = await Promise.all(
      chunks.map(async c => (await hashData(c)).buffer()) // eslint-disable-line comma-dangle
    );

    return await computeRoot(leftHashes);
  }

  export async function generateProof(
    hashes: readonly BufferLike[] | LogarithmicArray<BufferLike>,
    target: BufferLike | HashEntity // eslint-disable-line comma-dangle
  ): Promise<LogarithmicArray<HashEntity>> {
    const proof: LogarithmicArray<HashEntity> = new LogarithmicArray(80);

    if(!(target instanceof HashEntity)) {
      target = new HashEntity(chunkToBuffer(target));
    }

    const hashIndexMap = new Map<string, number>();
    const hashBuffers = array("log", hashes).map(chunkToBuffer);

    for(let i = 0; i < hashBuffers.size(); i++) {
      const h = await hashData(hashBuffers.get(i));
      hashIndexMap.set(h.buffer().toString("hex"), i);
    }

    const targetHex = target.buffer().toString("hex");
    let index = hashIndexMap.get(targetHex);

    if(typeof index !== "number" || index < 0) {
      throw new HyChainException("Couldn't generate proof for Merkle tree: target hash was not found in hashes list", "ERR_MISSING_OBJECT");
    }

    let level = hashBuffers;

    while(level.size() > 1) {
      const levelProofTasks: Promise<void>[] = [];
      const nextLevel: LogarithmicArray<Buffer> = new LogarithmicArray(80);

      for(let i = 0; i < level.size(); i += 2) {
        const left = level.get(i);
        const right = level.findByIndex(i + 1) ?? left;

        const combineTask = async () => {
          const combinedHash = await hashData(Buffer.concat([left, right]));
          nextLevel.push(combinedHash.buffer());

          if(i === index || i + 1 === index) {
            const sibling = (i === index) ? right : left;

            proof.push(new HashEntity(sibling));
            index = nextLevel.size() - 1;
          }
        };

        levelProofTasks.push(combineTask());
      }

      await Promise.all(levelProofTasks);
      level = nextLevel;
    }

    return proof;
  }

  export async function verifyProof(
    target: HashEntity | BufferLike,
    proof: readonly HashEntity[] | LogarithmicArray<HashEntity>,
    root: HashEntity | BufferLike // eslint-disable-line comma-dangle
  ): Promise<boolean> {
    let hash = target instanceof HashEntity ?
      target.buffer() :
      chunkToBuffer(target);

    proof = array("log", proof);

    for(let i = 0; i < proof.size(); i++) {
      const sibling = proof.get(i).buffer();

      hash = (await hashData(Buffer.concat([hash, sibling])))
        .buffer();
    }

    if(!(root instanceof HashEntity)) {
      root = new HashEntity(chunkToBuffer(root));
    }

    return root.equals(hash);
  }
}


export type SignAlgorithm = 
  | "HMAC-SHA256"
  | "HMAC-SHA384"
  | "HMAC-SHA512"
  | "ECDSA-SHA256"
  | "ECDSA-SHA384"
  | "ECDSA-SHA512"
  | "RSA-SHA256"
  | "RSA-SHA384"
  | "RSA-SHA512"
  | "Ed25519";

export async function sign(
  algorithm: SignAlgorithm,
  content: BufferLike | ReadableSource<BufferLike> | ReadableStream | IReader,
  signKey: BufferLike,
  optimizeForEd25519: boolean = true,
  token: ICancellationToken = CancellationToken.None // eslint-disable-line comma-dangle
): Promise<HashEntity> {
  const payload = await consumeBuffer(content, token);
  const writer = new BufferWriter();

  try {
    if(algorithm.startsWith("HMAC")) {
      const hmacAlg = algorithm.split("-")[1];
      const hmac = crypto.createHmac(hmacAlg.toLowerCase(), chunkToBuffer(signKey))
        .update(payload)
        .digest();

      writer.write(hmac);
    } else if(algorithm.startsWith("ECDSA") || algorithm.startsWith("RSA")) {
      const digestAlg = algorithm.split("-")[1];
      const signer = crypto.createSign(digestAlg);

      signer.update(payload);
      signer.end();

      const signature = signer.sign(chunkToBuffer(signKey));
      writer.write(signature);
    } else if(algorithm === "Ed25519") {
      const o: {
        key: Buffer;
        dsaEncoding?: "ieee-p1363";
      } = {
        key: chunkToBuffer(signKey),
        dsaEncoding: "ieee-p1363",
      };

      if(!optimizeForEd25519) {
        delete o.dsaEncoding;
      }

      const signature = crypto.sign(null, payload, o);
      writer.write(signature);
    } else {
      throw new HyChainException(`Unable to sign content with unknown algorithm '${algorithm}'`, "ERR_INVALID_TYPE");
    }

    if(token.isCancellationRequested) {
      throw new HyChainException("Asynchronous content signature was cancelled by token", "ERR_TOKEN_CANCELLED");
    }

    return new HashEntity(writer.drain());
  } finally {
    writer.dispose();
  }
}


export type HashAlgorithm = 
  | "SHA256"
  | "SHA384"
  | "SHA512";

export function hashData(
  payload: BufferLike,
  algorithm: HashAlgorithm = "SHA384",
  signKey?: BufferLike // eslint-disable-line comma-dangle
): Promise<HashEntity> {
  if(!signKey) {
    const hash = crypto.createHash(algorithm.toLowerCase())
      .update(chunkToBuffer(payload))
      .digest();

    return Promise.resolve(new HashEntity(hash));
  }

  const key = chunkToBuffer(signKey)
    .subarray(0, 64);

  return sign(`HMAC-${algorithm}`, payload, key, false);
}
