import * as crypto from "node:crypto";
import type { BufferLike } from "@rapid-d-kit/types";
import { IDisposable } from "@rapid-d-kit/disposable";

import { HyChainException } from "../errors";
import { BufferReader } from "../@internals/binary-protocol";
import { chunkToBuffer } from "../@internals/binary-protocol/buffer";


export class HashEntity implements IDisposable {
  readonly #content: BufferReader;
  readonly #state = { disposed: false };

  public constructor(source: BufferLike) {
    this.#content = new BufferReader( chunkToBuffer(source) );
  }

  public get byteLength(): number {
    this.#EnsureNotDisposed();
    return this.#content.byteLength;
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
    const view = new Uint8Array(buffer);

    view.set(this.#content.read());
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
