import type { BufferLike } from "@rapid-d-kit/types";
import { IDisposable } from "@rapid-d-kit/disposable";
import { assertUnsignedInteger } from "@rapid-d-kit/safe";

import Marshalling from "../marshalling";
import { chunkToBuffer } from "./buffer";
import { HyChainException } from "../../errors";
import { jsonSafeParser, jsonSafeStringify } from "../safe-json";


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


export const enum SerializableDataType {
  Null = 0,
  String = 1,
  Uint = 2,
  Object = 3,
  Array = 4,
  MarshallObject = 5,
  Buffer = 6,
}

export function createOneByteBuffer(value: number): Buffer {
  const result = Buffer.alloc(1);
  result.writeUInt8(value, 0);

  return result;
}

const BufferPresets: { readonly [K in keyof typeof SerializableDataType]: Buffer } = {
  Null: createOneByteBuffer(SerializableDataType.Null),
  String: createOneByteBuffer(SerializableDataType.String),
  Buffer: createOneByteBuffer(SerializableDataType.Buffer),
  Array: createOneByteBuffer(SerializableDataType.Array),
  Object: createOneByteBuffer(SerializableDataType.Object),
  Uint: createOneByteBuffer(SerializableDataType.Uint),
  MarshallObject: createOneByteBuffer(SerializableDataType.MarshallObject),
};


export function readIntVQL(reader: IReader): number {
  let value = 0;

  for(let n = 0; ; n += 7) {
    const next = reader.read(1);
    value |= (next[0] & 0b01111111) << n;

    if(!(next[0] & 0b10000000))
      return value;
  }
}

const vqlZero = createOneByteBuffer(0);

export function writeInt32VQL(writer: IWriter, value: number) {
  if(value === 0) return writer.write(vqlZero);

  let len = 0;

  for(let v2 = value; v2 !== 0; v2 = v2 >>> 7) {
    len++;
  }

  const scratch = Buffer.alloc(len);

  for(let i = 0; value !== 0; i++) {
    scratch[i] = value & 0b01111111;
    value = value >>> 7;

    if(value > 0) {
      scratch[i] |= 0b10000000;
    }
  }

  writer.write(scratch);
}


export function serialize(writer: IWriter, data: unknown): void {
  // Case A:
  if(data === null || typeof data === "undefined") {
    // The data is null or not defined
    writer.write(BufferPresets.Null);

    // Case B:
  } else if(typeof data === "string") {
    // The data is a string
    const buffer = Buffer.from(data);

    writer.write(BufferPresets.String);
    writeInt32VQL(writer, buffer.byteLength);
    writer.write(buffer);

    // Case C:
  } else if(data instanceof Uint8Array || Buffer.isBuffer(data)) {
    // The data is binary, either a Buffer or raw Uint8Array instance
    if(!Buffer.isBuffer(data)) {
      data = Buffer.from(data);
    }

    writer.write(BufferPresets.Buffer);
    writeInt32VQL(writer, (data as Buffer).byteLength);
    writer.write(data as Buffer);

    // Case D:
  } else if(typeof data === "number" && (data | 0) === data) {
    // The data is a number that allows bitwise operations (will be a unsigned integer)
    writer.write(BufferPresets.Uint);
    writeInt32VQL(writer, data);

    // Case E:
  } else if(Array.isArray(data)) {
    // The data is an array of unknown elements
    writer.write(BufferPresets.Array);
    writeInt32VQL(writer, data.length);

    for(let i = 0; i < data.length; i++) {
      serialize(writer, data[i]);
    }

    // Case F:
  } else if(Marshalling.isMarshallObject(data)) {
    // The data is a marshalled object
    const str = jsonSafeStringify(data);

    if(str.isLeft()) {
      throw str.value;
    }

    const buffer = Buffer.from(str.value);

    writer.write(BufferPresets.MarshallObject);
    writeInt32VQL(writer, buffer.byteLength);
    writer.write(buffer);

    // Case G:
  } else {
    // The data is not of a known type (will be serialized as JSON)
    const str = jsonSafeStringify(data);

    if(str.isLeft()) {
      throw str.value;
    }

    const buffer = Buffer.from(str.value);

    writer.write(BufferPresets.Object);
    writeInt32VQL(writer, buffer.byteLength);
    writer.write(buffer);
  }
}

export function deserialize<T = any>(reader: IReader): T {
  const dataType = reader.read(1).readUint8(0);

  switch(dataType) {
    // Case A: The data is null or not defined
    case SerializableDataType.Null:
      return null as T;

    // Case B: The data is a string
    case SerializableDataType.String:
      return reader.read(readIntVQL(reader)).toString() as T;

    // Case C: The data is a unsigned integer
    case SerializableDataType.Uint:
      return readIntVQL(reader) as T;

    // Case D: The data is a binary buffer
    case SerializableDataType.Buffer:
      return reader.read(readIntVQL(reader)) as T;

    // Case E: The data is an array of unknown elements
    case SerializableDataType.Array: {
      const len = readIntVQL(reader);
      const result: unknown[] = [];

      for(let i = 0; i < len; i++) {
        result.push(deserialize(reader));
      }

      return result as T;
    }

    // Case F: The data is a marshalled object
    case SerializableDataType.MarshallObject: {
      const parsed = jsonSafeParser<Marshalling.MarshallObject>(reader.read(readIntVQL(reader)).toString());

      if(parsed.isLeft()) {
        throw parsed.value;
      }

      return Marshalling.revive(parsed.value) as T;
    }

    // Case G: The data is not of a known type (parse as JSON)
    case SerializableDataType.Object: {
      const parsed = jsonSafeParser<T>(reader.read(readIntVQL(reader)).toString());

      if(parsed.isLeft()) {
        throw parsed.value;
      }

      return parsed.value;
    }

    // Case H (default): The buffer is not serialized
    default:
      throw new HyChainException(`Cannot deserialize a unknown data buffer (0x${dataType.toString(16).toUpperCase()})`, "ERR_UNSUPPORTED_OPERATION");
  }
}
