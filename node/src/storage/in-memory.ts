import { LogarithmicArray } from "array-t";

import HyChainFormat from "../format";
import { HyChainException } from "../errors";
import { AbstractStorageObject } from "./interface";


class InMemoryStorage extends AbstractStorageObject {
  private readonly _blocksById = new Map<HyChainFormat.BlockId, HyChainFormat.IBlock>();
  private readonly _blocksBySeq = new Map<number, HyChainFormat.IBlock>();

  public constructor() {
    console.warn("[HY CHAIN] Attention: You're currently using an in-memory implementation of blockchain storage. It can be dangerous because uses volatile memory and will be erased when server restarts.");
    super();

    super.onDispose(() => {
      this._blocksById.clear();
      this._blocksBySeq.clear();
    });
  }

  public async putBlock(b: HyChainFormat.IBlock): Promise<boolean> {
    this.#EnsureNotDisposed();
    if(this._blocksById.has(b._id)) return false;

    if(!this._validateBlock(b))
      return false;

    this._blocksById.set(b._id, b);
    this._blocksBySeq.set(b.sequence, b);
    return true;
  }

  public async getBlock(id: HyChainFormat.BlockId): Promise<HyChainFormat.IBlock | null> {
    this.#EnsureNotDisposed();
    return this._blocksById.get(id) ?? null;
  }

  public async hasBlock(id: HyChainFormat.BlockId): Promise<boolean> {
    this.#EnsureNotDisposed();
    return this._blocksById.has(id);
  }

  public async getBlockBySequence(seq: number): Promise<HyChainFormat.IBlock | null> {
    this.#EnsureNotDisposed();
    return this._blocksBySeq.get(seq) ?? null;
  }

  public async getLatestBlock(): Promise<HyChainFormat.IBlock | null> {
    this.#EnsureNotDisposed();
    if (this._blocksBySeq.size === 0) return null;

    const maxSeq = Math.max(...this._blocksBySeq.keys());
    return this._blocksBySeq.get(maxSeq) ?? null;
  }

  public async getAllBlocks(): Promise<LogarithmicArray<HyChainFormat.IBlock>> {
    this.#EnsureNotDisposed();

    const arr = Array.from(this._blocksBySeq.values())
      .sort((a, b) => a.sequence - b.sequence);

    const result = new LogarithmicArray<HyChainFormat.IBlock>(80);

    result.push(...arr);

    return result;
  }

  #EnsureNotDisposed(): void {
    if(this._isDisposed()) {
      throw new HyChainException("This instance of InMemoryStorage is already disposed and cannot be used anymore", "ERR_RESOURCE_DISPOSED");
    }
  }
}

export default InMemoryStorage;
