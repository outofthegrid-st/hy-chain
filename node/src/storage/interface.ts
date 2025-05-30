import { LogarithmicArray } from "array-t";
import { assert } from "@rapid-d-kit/safe";
import { IDisposable } from "@rapid-d-kit/disposable";

import HyChainFormat from "../format";


export interface IStorage extends IDisposable {
  putBlock(b: HyChainFormat.IBlock): Promise<boolean>;
  getBlock(id: HyChainFormat.BlockId): Promise<HyChainFormat.IBlock | null>;
  hasBlock(id: HyChainFormat.BlockId): Promise<boolean>;
  getLatestBlock(): Promise<HyChainFormat.IBlock | null>;
  getBlockBySequence(seq: number): Promise<HyChainFormat.IBlock | null>;
  getAllBlocks(): Promise<LogarithmicArray<HyChainFormat.IBlock>>;
}


export abstract class AbstractStorageObject implements IStorage {
  readonly #internalState = {
    disposed: false,
    disposeListeners: new Set<() => unknown>(),
  };

  public abstract putBlock(b: HyChainFormat.IBlock): Promise<boolean>;
  public abstract getBlock(id: HyChainFormat.BlockId): Promise<HyChainFormat.IBlock | null>;
  public abstract hasBlock(id: HyChainFormat.BlockId): Promise<boolean>;
  public abstract getBlockBySequence(seq: number): Promise<HyChainFormat.IBlock | null>;
  public abstract getLatestBlock(): Promise<HyChainFormat.IBlock | null>;
  public abstract getAllBlocks(): Promise<LogarithmicArray<HyChainFormat.IBlock>>;

  protected _isDisposed(): boolean {
    return this.#internalState.disposed;
  }

  protected _validateBlock(source: unknown): source is HyChainFormat.IBlock {
    if(!source || typeof source !== "object")
      return false;

    /* if(source instanceof Block)
      return true; */

    // TODO: more strong validation!
    return false;
  }

  public onDispose(callback: () => unknown): void {
    if(!this.#internalState.disposed) {
      assert(typeof callback === "function");
      this.#internalState.disposeListeners.add(callback);
    }
  }

  public dispose(): void {
    if(!this.#internalState.disposed) {
      for(const listener of this.#internalState.disposeListeners.values()) {
        try {
          listener.call(null);
          // eslint-disable-next-line no-empty
        } catch { }
      }

      this.#internalState.disposeListeners.clear();
      this.#internalState.disposed = true;
    }
  }
}
