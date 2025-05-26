import type { BufferLike } from "@rapid-d-kit/types";
import { IDisposable } from "@rapid-d-kit/disposable";
import { assertUnsignedInteger } from "@rapid-d-kit/safe";

import { chunkToBuffer } from "./buffer";
import { HyChainException } from "../../errors";


export interface IReader extends IDisposable {
  readonly readable: boolean;
  read(length?: number): Buffer;
}

export interface IWriter extends IDisposable {
  readonly byteLength: number;
  readonly buffer: Buffer;

  write(data: BufferLike): void;
  drain(): Buffer;
}


export class BufferWriter implements IWriter {
  readonly #state = {
    buffers: [] as Buffer[],
    bytes: 0,
    disposed: false,
  };

  public get buffer(): Buffer {
    this.#EnsureNotDisposed();
    return Buffer.concat(this.#state.buffers);
  }

  public get byteLength(): number {
    this.#EnsureNotDisposed();
    return this.#state.bytes;
  }

  public write(data: BufferLike): void {
    this.#EnsureNotDisposed();

    const buffer = chunkToBuffer(data);

    this.#state.buffers.push(buffer);
    this.#state.bytes += buffer.byteLength;
  }

  public drain(): Buffer {
    this.#EnsureNotDisposed();

    const result = Buffer.concat(this.#state.buffers);

    this.#DisposeInstance();
    return result;
  }

  public dispose(): void {
    return this.#DisposeInstance();
  }

  #DisposeInstance(): void {
    if(!this.#state.disposed) {
      this.#state.buffers = null!;
      this.#state.bytes = 0;

      this.#state.disposed = true;
    }
  }

  #EnsureNotDisposed(): void {
    if(this.#state.disposed) {
      throw new HyChainException("This instance of BufferWriter is already disposed and cannot be used anymore", "ERR_RESOURCE_DISPOSED");
    }
  }
}


export class BufferReader implements IReader {
  #data: Buffer;

  readonly #state = {
    disposed: false,
    total: -1,
    cursor: 0,
  };

  public constructor(data: BufferLike) {
    this.#data = chunkToBuffer(data);
    this.#state.total = this.#data.byteLength;
  }

  public get consumed(): number {
    this.#EnsureNotDisposed();
    return this.#state.cursor;
  }

  public get remaining(): number {
    this.#EnsureNotDisposed();
    return this.#data.byteLength - this.#state.cursor;
  }

  public get byteLength(): number {
    this.#EnsureNotDisposed();
    return this.#state.total;
  }

  public get buffer(): Buffer {
    this.#EnsureNotDisposed();

    const result = Buffer.alloc(this.#data.byteLength);
    this.#data.copy(result);

    return result;
  }

  public get readable(): boolean {
    if(this.#state.disposed)
      return false;

    return this.#state.cursor < this.#data.byteLength;
  }

  public read(byteLength?: number): Buffer {
    this.#EnsureNotDisposed();
    
    if(this.#state.cursor >= this.#data.byteLength) {
      throw new HyChainException("The buffer has already been completely consumed", "ERR_END_OF_STREAM");
    }

    if(typeof byteLength !== "number") {
      const remaining = this.#data.byteLength - this.#state.cursor;
      const result = Buffer.alloc(remaining);

      this.#data.copy(result, 0, this.#state.cursor);
      this.#state.cursor = this.#data.byteLength;

      this.#data = null!;
      return result;
    }

    assertUnsignedInteger(byteLength, "The length to read from a buffer should be a unsigned integer");

    const remaining = this.#data.byteLength - this.#state.cursor;
    const len = Math.min(byteLength, remaining);

    const chunk = Buffer.alloc(len);
    this.#data.copy(chunk, 0, this.#state.cursor, this.#state.cursor + len);

    this.#state.cursor += len;
    return chunk;
  }

  public dispose(): void {
    return this.#DisposeInstance();
  }

  #DisposeInstance(): void {
    if(!this.#state.disposed) {
      this.#data = null!;

      this.#state.cursor = -1;
      this.#state.total = -1;
      this.#state.disposed = true;
    }
  }

  #EnsureNotDisposed(): void {
    if(this.#state.disposed) {
      throw new HyChainException("This instance of BufferReader is already disposed and cannot be used anymore", "ERR_RESOURCE_DISPOSED");
    }
  }
}
