import type { BufferLike } from "@rapid-d-kit/types";
import { Readable as ReadableStream } from "node:stream";
import { CancellationToken, ICancellationToken } from "@rapid-d-kit/async";
import { Readable as ReadableSource, isReadable, isReadableStream } from "ndforge/stream";

import { HyChainException } from "../errors";
import { BufferWriter, chunkToBuffer, IReader } from "../@internals/binary-protocol";


export async function consumeBuffer(
  source: BufferLike | ReadableSource<BufferLike> | ReadableStream | IReader,
  token: ICancellationToken = CancellationToken.None // eslint-disable-line comma-dangle
): Promise<Buffer> {
  if(token.isCancellationRequested) {
    throw new HyChainException("Asynchronous buffer digest was cancelled by token", "ERR_TOKEN_CANCELLED");
  }

  const writer = new BufferWriter();

  if(isReadableStream(source)) return new Promise<Buffer>((resolve, reject) => {
    token.onCancellationRequested(reject);
    
    source.on("error", err => {
      writer.dispose();
      reject(err);
    });

    source.on("end", () => {
      if(token.isCancellationRequested)
        return reject(new HyChainException("Asynchronous buffer digest was cancelled by token", "ERR_TOKEN_CANCELLED"));
  
      resolve(writer.drain());
    });

    source.on("data", chunk => {
      writer.write(chunkToBuffer(chunk));
    });
  });

  if(isReadable(source)) {
    writer.write(chunkToBuffer(source.read()));
  } else if (
    typeof source === "object" &&
    !!source &&
    ("read" in source) &&
    ("readable" in source) &&
    typeof source.read === "function"
  ) {
    if(!source.readable) {
      throw new HyChainException("The given object is not readable", "ERR_STREAM_CLOSED");
    }

    while(source.readable) {
      writer.write(chunkToBuffer(source.read()));
    }
  } else {
    writer.write(chunkToBuffer(source));
  }

  if(token.isCancellationRequested) {
    throw new HyChainException("Asynchronous buffer digest was cancelled by token", "ERR_TOKEN_CANCELLED");
  }

  return writer.drain();
}
