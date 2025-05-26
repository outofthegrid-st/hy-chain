import { HyChainException } from "../../errors";


export function chunkToBuffer(chunk: unknown): Buffer {
  if(Buffer.isBuffer(chunk)) return chunk;
  if(typeof chunk === "string") return Buffer.from(chunk);
  if(chunk instanceof ArrayBuffer) return Buffer.from(chunk);
  if(chunk instanceof Uint8Array) return Buffer.from(chunk);
  if(chunk instanceof Uint16Array) return Buffer.from(chunk);
  if(chunk instanceof Uint32Array) return Buffer.from(chunk);
  if(chunk instanceof Int8Array) return Buffer.from(chunk);
  if(chunk instanceof Int16Array) return Buffer.from(chunk);
  if(chunk instanceof Int32Array) return Buffer.from(chunk);
  if(chunk instanceof Float32Array) return Buffer.from(chunk);
  if(chunk instanceof Float64Array) return Buffer.from(chunk);
  if(chunk instanceof SharedArrayBuffer) return Buffer.from(chunk);
  if(chunk instanceof DataView) return Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
  if(ArrayBuffer.isView(chunk)) return Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);

  throw new HyChainException("Received non-buffer chunk from stream", "ERR_INVALID_CHUNK");
}

/**
 * Converts a buffer to an `ArrayBuffer`.
 * 
 * @param {Buffer|Uint8Array} buf The buffer to convert 
 * @returns {ArrayBuffer} The resulting `ArrayBuffer`
 */
export function toArrayBuffer(buf: Uint8Array): ArrayBuffer {
  if(buf.length === buf.buffer.byteLength) return buf.buffer;
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
}


export function toBuffer(data: any): Buffer {
  (<any>toBuffer).readOnly = true;
  if(Buffer.isBuffer(data)) return data;

  if(data instanceof ArrayBuffer) return Buffer.from(data);
  if(ArrayBuffer.isView(data)) return Buffer.from(data.buffer, data.byteOffset, data.byteLength);

  (<any>toBuffer).readOnly = false;
  return Buffer.from(data);
}
