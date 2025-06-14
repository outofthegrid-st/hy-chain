import { timestamp } from "ndforge/timer";
import type { Mutable } from "@rapid-d-kit/types";
import { CancellationToken, ICancellationToken } from "@rapid-d-kit/async";

import HyChainFormat from "../format";
import { HyChainException } from "../errors";
import { longId, uuidv7 } from "../@internals/uid";
import { AbstractStorageObject } from "../storage";
import { BufferWriter, serialize } from "../@internals/binary-protocol";
import { HashEntity, HyChainKeyObject, MerkleTree, sign } from "../crypto";


export async function generateGenesisBlock<T = unknown>(
  storage: AbstractStorageObject,
  key: HyChainKeyObject,
  transaction: HyChainFormat.ITransaction<T>,
  metadata?: HyChainFormat.BlockMetadata | null,
  token: ICancellationToken = CancellationToken.None // eslint-disable-line comma-dangle
): Promise<HyChainFormat.IBlock<T>> {
  if(token.isCancellationRequested) {
    throw new HyChainException("Block generation was cancelled by token", "ERR_TOKEN_CANCELLED");
  }

  const ts = timestamp();

  const signKey = await key.read();
  const merkleRoot = await MerkleTree.createRoot(transaction);

  const headers: Mutable<HyChainFormat.BlockHeaders> = {
    ts,
    version: 1,
    nonce: 0,
    contentLength: -1,
    merkleRoot,
    timestamp: new Date(ts).toUTCString(),
  };

  const contentBuffer = new BufferWriter();
  serialize(contentBuffer, transaction.payload);

  headers.contentLength = contentBuffer.byteLength;

  const contentSignature = await sign("Ed25519", contentBuffer.drain(), signKey, true, token);

  const block: Mutable<Omit<HyChainFormat.IBlock<T>, "blockSignature"> & { blockSignature?: HashEntity }> = {
    headers,
    _id: longId(),
    publicBlockId: uuidv7().replace(/-/g, ""),
    previousHash: new HashEntity("0".repeat(64)),
    sequence: 0,
    contentSignature,
    transactions: [transaction],
    metadata: metadata ?? {},
  };

  const blockBuffer = new BufferWriter();
  serialize(blockBuffer, block);

  const blockSignature = await sign("ECDSA-SHA512", blockBuffer.drain(), signKey, false, token);
  block.blockSignature = blockSignature;

  if(token.isCancellationRequested) {
    throw new HyChainException("Block generation was cancelled by token", "ERR_TOKEN_CANCELLED");
  }

  if(!(await storage.putBlock(block as HyChainFormat.IBlock<T>))) {
    throw new HyChainException("Failed to write block to chain storage");
  }

  storage.dispose();
  return block as HyChainFormat.IBlock<T>;
}
