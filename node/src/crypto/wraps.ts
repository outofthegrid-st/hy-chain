import * as crypto from "node:crypto";
import type { BufferLike } from "@rapid-d-kit/types";

import { HyChainException } from "../errors";
import { isBase64 } from "../@internals/util";
import { BufferWriter, chunkToBuffer } from "../@internals/binary-protocol";


const ARMORED_CONTENT_MAGIC_BUFFER = Buffer.from([
  0x48, 0x59, 0x20, 0x43, 0x48,
  0x41, 0x49, 0x4E, 0x20, 0x41,
  0x52, 0x4D, 0x4F, 0x52, 0x45,
  0x44, 0x20, 0x4B, 0x45, 0x59,
]);


export function armor(
  e: boolean,
  source: BufferLike,
  key?: BufferLike | null // eslint-disable-line comma-dangle
): Buffer;

export function armor(
  e: boolean,
  source: BufferLike,
  key: BufferLike | null,
  encoding: BufferEncoding // eslint-disable-line comma-dangle
): string;

export function armor(
  e: boolean,
  source: BufferLike,
  key?: BufferLike | null,
  encoding?: BufferEncoding // eslint-disable-line comma-dangle
): Buffer | string {
  const finalResult = new BufferWriter();

  finalResult.write(ARMORED_CONTENT_MAGIC_BUFFER);
  finalResult.write(new Uint8Array([ e ? 1 : 0 ]));

  if(!e) {
    finalResult.write( chunkToBuffer(source) );
    const buffer = finalResult.drain();

    return encoding && Buffer.isEncoding(encoding) ?
      buffer.toString(encoding) :
      buffer;
  }
  
  const [masterKey, iv] = parseKey(key);
  
  const writer = new BufferWriter();
  const cipher = crypto.createCipheriv("aes-128-cbc", masterKey, iv);

  writer.write(cipher.update( chunkToBuffer(source) ));
  writer.write(cipher.final());

  finalResult.write(writer.drain());
  const result = finalResult.drain();

  return encoding && Buffer.isEncoding(encoding) ?
    result.toString(encoding) :
    result;
}


export function dearmor(
  source: BufferLike,
  key?: BufferLike | null,
  inputEncoding?: BufferEncoding
): Buffer;

export function dearmor(
  source: BufferLike,
  key: BufferLike | null,
  inputEncoding: BufferEncoding | undefined,
  outputEncoding: BufferEncoding
): string;

export function dearmor(
  source: BufferLike,
  key?: BufferLike | null,
  inputEncoding?: BufferEncoding,
  outputEncoding?: BufferEncoding,
): Buffer | string {
  let buffer: Buffer;

  if(typeof source === "string") {
    if(inputEncoding && Buffer.isEncoding(inputEncoding)) {
      buffer = Buffer.from(source, inputEncoding);
    } else if(isBase64(source)) {
      buffer = Buffer.from(source, "base64");
    } else {
      buffer = chunkToBuffer(source);
    }
  } else {
    buffer = chunkToBuffer(source);
  }

  const magicLength = ARMORED_CONTENT_MAGIC_BUFFER.length;

  if(buffer.subarray(0, magicLength).compare(ARMORED_CONTENT_MAGIC_BUFFER) !== 0) {
    throw new HyChainException("Invalid armored content magic header", "ERR_MAGIC_NUMBER_MISSMATCH");
  }

  const flag = buffer[magicLength];
  const content = buffer.subarray(magicLength + 1);

  let result: Buffer;

  if(flag === 0) {
    result = content;
  } else if(flag === 1) {
    const [masterKey, iv] = parseKey(key);
    const decipher = crypto.createDecipheriv("aes-128-cbc", masterKey, iv);

    const writer = new BufferWriter();
    writer.write(decipher.update(content));
    writer.write(decipher.final());

    result = writer.drain();
  } else {
    throw new HyChainException("Unknown armor flag", "ERR_INVALID_BITFLAG");
  }

  return outputEncoding && Buffer.isEncoding(outputEncoding) ?
    result.toString(outputEncoding) :
    result;
}



const ALGORITHM = { length: 16, ivLength: 16 };

function parseKey(key?: BufferLike | null): readonly [Buffer, Buffer] {
  const buffer = chunkToBuffer(key);

  if(ALGORITHM.length + ALGORITHM.ivLength > buffer.length) {
    throw new HyChainException("Failed to parse armor key because it's too short", "ERR_CRYPTO_KEY_SHORT");
  }

  return [
    buffer.subarray(0, ALGORITHM.length),
    buffer.subarray(ALGORITHM.length, ALGORITHM.length + ALGORITHM.ivLength),
  ];
}
