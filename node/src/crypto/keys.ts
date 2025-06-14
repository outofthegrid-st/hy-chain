import * as crypto from "node:crypto";
import { IDisposable } from "@rapid-d-kit/disposable";
import type { BufferLike, MaybePromise } from "@rapid-d-kit/types";
import { CancellationToken, ICancellationToken } from "@rapid-d-kit/async";
import { type EntropyBufferRequest, type EntropyDevice, generateRandomBytes } from "ndforge";

import { armor, dearmor } from "./wraps";
import { BufferReader, chunkToBuffer } from "../@internals/binary-protocol";
import { HyChainException, HyChainNotImplementedException } from "../errors";


export type KnownAlgorithm = 
  | "RSA"
  | "ECDSA"
  | "Ed25519"
  | "SHA256"
  | "SHA384"
  | "SHA512"
  | "AES-CBC-128"
  | "AES-CBC-256"
  | "AES-GCM-128"
  | "AES-GCM-256"
  | "AES-CCM-128"
  | "AES-CCM-256"
  | "CHACHA20";


export type Alg = {
  kind: "secret" | "public" | "private";
  length: number;
  ivLength?: number;
  authTagLength?: number;
  name?: string;
};


export interface KeyDetails {
  label: BufferLike;
  userId?: BufferLike;
}


export type KeyInfo = KeyDetails & Alg & Partial<Omit<crypto.AsymmetricKeyDetails, "publicExponent"> & {
  publicExponent?: number | bigint | string;
}>;


export interface IKey extends IDisposable {
  getDetails(): KeyDetails;
  setDetails(o: Partial<KeyDetails>): IKey;
  read(length?: number | null): MaybePromise<Buffer>;
  master(): MaybePromise<Buffer>;
  iv(): MaybePromise<Buffer | null>;
  authTag(): MaybePromise<Buffer | null>;
  collectAuthTag(tag: BufferLike): IKey;
  leftBuffer(): MaybePromise<Buffer | null>;

  armor(): MaybePromise<Buffer>;
  armor(encoding: BufferEncoding): MaybePromise<string>;
}


export type KeyReaderOptions = {
  inputFormat?: "armored" | "base64" | "hex" | "pem" | "raw";
  algorithm?: KnownAlgorithm | Alg;
};


const DEFAULT_RSA_MODULUS_LENGTH = 2048;
const STANDARD_HASHING_LENGTH = 64;


class HyChainKeyObject implements IKey {
  #keyMaterial: BufferReader;
  #details: KeyDetails;
  #asymmetricDetails?: crypto.AsymmetricKeyDetails;
  #algorithm: Alg;

  #state = {
    disposed: false,
    armorKey: null as Buffer | null,
    format: "raw" as NonNullable<KeyReaderOptions["inputFormat"]>,
  };

  private constructor(
    _source: BufferLike,
    _format: NonNullable<KeyReaderOptions["inputFormat"]>,
    _algorithm: Alg,
    _armorKey: Buffer,
    _details?: KeyDetails,
    _asymmetricDetails?: crypto.AsymmetricKeyDetails // eslint-disable-line comma-dangle
  ) {
    this.#keyMaterial = new BufferReader(chunkToBuffer(_source));

    this.#algorithm = _algorithm;
    this.#details = _details ?? { label: "$$default" };
    this.#asymmetricDetails = _asymmetricDetails;
    this.#state.format = _format;
    this.#state.armorKey = Buffer.isBuffer(_armorKey) ? _armorKey : null;
  }

  public getInfo(): KeyInfo {
    this.#EnsureNotDisposed();

    return {
      ...this.#details,
      ...this.#algorithm,
      ...this.#asymmetricDetails,

      publicExponent: typeof this.#asymmetricDetails?.publicExponent === "bigint"
        ? `bigint:${this.#asymmetricDetails.publicExponent.toString()}`
        : this.#asymmetricDetails?.publicExponent,
    };
  }

  public getDetails(): KeyDetails {
    this.#EnsureNotDisposed();
    return { ...this.#details };
  }

  public setDetails(o: Partial<KeyDetails>): this {
    this.#EnsureNotDisposed();

    this.#details = { ...this.#details, ...o };

    return this;
  }

  public async read(length?: number | null): Promise<Buffer> {
    this.#EnsureNotDisposed();

    await this.#ReadKey();
    return this.#keyMaterial.read(length ?? void 0);
  }

  public armor(): Promise<Buffer>;
  public armor(encoding: BufferEncoding): Promise<string>;

  public async armor(encoding?: BufferEncoding): Promise<Buffer | string> {
    const buffer = await this.#ReadKey();
    const finalKey = armor(true, buffer, this.#state.armorKey);

    return encoding && Buffer.isEncoding(encoding) ?
      finalKey.toString(encoding) :
      finalKey;
  }

  public async master(): Promise<Buffer> {
    this.#EnsureNotDisposed();

    const buffer = await this.#ReadKey();

    return this.#algorithm.kind === "secret"
      ? buffer.subarray(0, this.#algorithm.length)
      : buffer;
  }

  public async iv(): Promise<Buffer | null> {
    this.#EnsureNotDisposed();

    if(this.#algorithm.kind !== "secret" || !this.#algorithm.ivLength)
      return null;

    const offset = this.#algorithm.length;
    const end = offset + this.#algorithm.ivLength;

    if(end > this.#keyMaterial.byteLength)
      return null;

    return (await this.#ReadKey()).subarray(offset, end);
  }

  public async authTag(): Promise<Buffer | null> {
    this.#EnsureNotDisposed();

    if(this.#algorithm.kind !== "secret" || !this.#algorithm.authTagLength)
      return null;

    const offset = this.#algorithm.length + (this.#algorithm.ivLength ?? 0);
    const end = offset + this.#algorithm.authTagLength;

    if(end > this.#keyMaterial.byteLength)
      return null;

    return (await this.#ReadKey()).subarray(offset, end);
  }

  public collectAuthTag(tag: BufferLike): this {
    this.#EnsureNotDisposed();

    if(this.#algorithm.kind !== "secret") {
      throw new HyChainException("Cannot collect auth tag for an asymmetric key", "ERR_UNSUPPORTED_OPERATION");
    }

    const leftIndex = this.#algorithm.length + (this.#algorithm.ivLength ?? 0);
    const buffer = this.#ReadKey();

    const leftBuffer = buffer.subarray(0, leftIndex);
    const rightBuffer = buffer.subarray(leftIndex);

    this.#keyMaterial = new BufferReader(Buffer.concat([
      leftBuffer,
      chunkToBuffer(tag),
      rightBuffer,
    ]));

    this.#state.format = "raw";
    return this;
  }

  public async leftBuffer(): Promise<Buffer | null> {
    this.#EnsureNotDisposed();

    if(this.#algorithm.kind !== "secret")
      return null;

    const requiredLength = this.#algorithm.length + (this.#algorithm.ivLength ?? 0) + (this.#algorithm.authTagLength ?? 0);

    if(requiredLength > this.#keyMaterial.byteLength)
      return null;

    return (await this.#ReadKey()).subarray(requiredLength);
  }

  public dispose(): void {
    if(!this.#state.disposed) {
      this.#keyMaterial.dispose();
      this.#state.disposed = true;
    }
  }

  #EnsureNotDisposed(): void {
    if (this.#state.disposed) {
      throw new HyChainException("Key object is already disposed and cannot be used anymore", "ERR_RESOURCE_DISPOSED");
    }
  }

  #ReadKey(): Buffer {
    if(this.#state.format === "raw")
      return this.#keyMaterial.buffer;

    if(
      this.#state.format === "base64" ||
      this.#state.format === "hex"
    ) {
      const buffer = Buffer.from(this.#keyMaterial.buffer.toString(), this.#state.format as "hex" | "base64");
      this.#keyMaterial = new BufferReader(buffer);

      this.#state.format = "raw";
      return this.#keyMaterial.buffer;
    }

    if(this.#state.format === "armored") {
      const buffer = this.#keyMaterial.read();

      this.#keyMaterial = new BufferReader(dearmor(buffer, this.#state.armorKey));
      this.#state.format = "raw";

      return this.#keyMaterial.buffer;
    }

    throw new HyChainNotImplementedException("HyChainKeyObject##ReadKey()");
  }

  public static generateAsymmetricKeyPair(
    algorithm: "RSA" | "ECDSA" | "Ed25519",
    o?: crypto.AsymmetricKeyDetails & { paramEncoding?: "explicit" | "named" } // eslint-disable-line comma-dangle
  ): Promise<readonly [HyChainKeyObject, HyChainKeyObject]> {
    return this.#DoAsymmetricKeyGeneration(algorithm, o);
  }

  public static generateSymmetricKey(
    algorithm: Exclude<KnownAlgorithm, "RSA" | "ECDSA" | "Ed25519"> | Alg,
    entropy?: EntropyDevice | EntropyBufferRequest,
    token: ICancellationToken = CancellationToken.None // eslint-disable-line comma-dangle
  ): Promise<HyChainKeyObject> {
    return this.#DoSymmetricKeyGeneration(algorithm, entropy, token);
  }

  static async #DoSymmetricKeyGeneration(
    algorithm: Exclude<KnownAlgorithm, "RSA" | "ECDSA" | "Ed25519"> | Alg,
    entropy?: EntropyDevice | EntropyBufferRequest,
    token: ICancellationToken = CancellationToken.None // eslint-disable-line comma-dangle
  ): Promise<HyChainKeyObject> {
    if(token.isCancellationRequested) {
      throw new HyChainException("Symmetric key generation was cancelled by token", "ERR_TOKEN_CANCELLED");
    }

    const { length, ivLength = 0, authTagLength = 0 } = _getAlgorithmLengths(algorithm);
    const finalLength = length + ivLength + authTagLength + 8;

    const buffer = await (
      entropy ?
        generateRandomBytes(finalLength, entropy, token) :
        generateRandomBytes(finalLength, token)
    );

    if(token.isCancellationRequested) {
      throw new HyChainException("Symmetric key generation was cancelled by token", "ERR_TOKEN_CANCELLED");
    }

    const armorKey = await (
      entropy ?
        generateRandomBytes(40, entropy, token) :
        generateRandomBytes(40, token)
    );

    return new HyChainKeyObject(
      buffer,
      "raw",
      {
        kind: "secret",
        length,
        authTagLength,
        ivLength,
        name: typeof algorithm === "string" ?
          algorithm :
          algorithm.name,
      },
      armorKey // eslint-disable-line comma-dangle
    );
  }

  static async #DoAsymmetricKeyGeneration(
    algorithm: "RSA" | "ECDSA" | "Ed25519",
    o?: crypto.AsymmetricKeyDetails & { paramEncoding?: "explicit" | "named" },
    entropy?: EntropyDevice | EntropyBufferRequest,
    token?: ICancellationToken // eslint-disable-line comma-dangle
  ): Promise<readonly [HyChainKeyObject, HyChainKeyObject]> {
    const armorKey = await (
      entropy ?
        generateRandomBytes(40, entropy, token) :
        generateRandomBytes(40, token)
    );

    switch(algorithm) {
      case "RSA": {
        const mLength = [DEFAULT_RSA_MODULUS_LENGTH, DEFAULT_RSA_MODULUS_LENGTH * 2].includes(o?.modulusLength ?? 0)
          ? o!.modulusLength!
          : DEFAULT_RSA_MODULUS_LENGTH;

        return new Promise((resolve, reject) => {
          crypto.generateKeyPair("rsa", {
            modulusLength: mLength,
            publicExponent: typeof o?.publicExponent === "number" ? o.publicExponent : undefined,
          }, (err, pko, sko) => {
            // eslint-disable-next-line no-extra-boolean-cast
            if(!!err)
              return reject(err);

            resolve([
              new HyChainKeyObject(
                pko.export({ format: "der", type: "pkcs1" }),
                "raw",
                { kind: "public", name: "RSA", length: mLength },
                armorKey,
                void 0,
                pko.asymmetricKeyDetails,
              ),
              
              new HyChainKeyObject(
                sko.export({ format: "der", type: "pkcs1" }),
                "raw",
                { kind: "private", name: "RSA", length: mLength },
                armorKey,
                void 0,
                sko.asymmetricKeyDetails,
              ),
            ]);
          });
        });
      } break;
      case "ECDSA": {
        return new Promise((resolve, reject) => {
          crypto.generateKeyPair("ec", {
            namedCurve: "secp256k1",
            paramEncoding: o?.paramEncoding,
          }, (err, pko, sko) => {
            // eslint-disable-next-line no-extra-boolean-cast
            if(!!err)
              return reject(err);

            resolve([
              new HyChainKeyObject(
                pko.export({ format: "der", type: "spki" }),
                "raw",
                { kind: "public", name: "ECDSA", length: 33 },
                armorKey,
                void 0,
                pko.asymmetricKeyDetails,
              ),

              new HyChainKeyObject(
                sko.export({ format: "der", type: "sec1" }),
                "raw",
                { kind: "private", name: "ECDSA", length: 32 },
                armorKey,
                void 0,
                sko.asymmetricKeyDetails,
              ),
            ]);
          });
        });
      } break;
      case "Ed25519": {
        return new Promise((resolve, reject) => {
          crypto.generateKeyPair("ed25519", {}, (err, pko, sko) => {
            // eslint-disable-next-line no-extra-boolean-cast
            if(!!err)
              return reject(err);

            resolve([
              new HyChainKeyObject(
                pko.export({ format: "der", type: "spki" }),
                "raw",
                { kind: "public", name: "ED25519", length: 32 },
                armorKey,
                void 0,
                pko.asymmetricKeyDetails,
              ),

              new HyChainKeyObject(
                sko.export({ format: "der", type: "pkcs8" }),
                "raw",
                { kind: "private", name: "ED25519", length: 32 },
                armorKey,
                void 0,
                sko.asymmetricKeyDetails,
              ),
            ]);
          });
        });
      } break;
      default:
        throw new HyChainException(`Failed to generate asymmetric key to unknown algorithm '${algorithm}'`, "ERR_INVALID_ARGUMENT");
    }
  }
}

function _getAlgorithmLengths(algorithm: Exclude<KnownAlgorithm, "RSA" | "ECDSA" | "Ed25519"> | Alg): {
  length: number;
  ivLength?: number;
  authTagLength?: number;
} {
  if(typeof algorithm === "object")
    return {
      length: algorithm.length,
      ivLength: algorithm.ivLength,
      authTagLength: algorithm.authTagLength,
    };

  switch(algorithm) {
    case "SHA256":
    case "SHA384":
    case "SHA512":
      return { length: STANDARD_HASHING_LENGTH };
    case "AES-CBC-128":
      return { length: 16, ivLength: 16 };
    case "AES-CBC-256":
      return { length: 32, ivLength: 16 };
    case "AES-GCM-128":
    case "AES-CCM-128":
      return { length: 16, ivLength: 12, authTagLength: 16 };
    case "AES-GCM-256":
    case "AES-CCM-256":
      return { length: 32, ivLength: 12, authTagLength: 16 };
    case "CHACHA20":
      return { length: 32, ivLength: 12 };
    default:
      throw new HyChainException(`Unable to generate a key for unknown algorithm '${algorithm}'`, "ERR_INVALID_ARGUMENT");
  }
}

export default HyChainKeyObject;
