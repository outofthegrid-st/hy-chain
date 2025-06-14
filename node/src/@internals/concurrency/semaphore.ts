import { timestamp } from "ndforge/timer";
import { assertUnsignedInteger } from "@rapid-d-kit/safe";

import { HyChainException } from "../../errors";


type Task<T = unknown> = {
  weight: number;
  priority: number;
  resolve: (value: T) => void;
  reject: (err: HyChainException) => void;
  timeoutId?: NodeJS.Timeout;
};


let DEBUG_LOCKS = false;


export function enableLockDebug(e: boolean): void {
  DEBUG_LOCKS = (e === true);

  if(DEBUG_LOCKS) {
    console.log("[Lock Debug] Enabled at %d", void 0, timestamp());
  }
}

function debugLog(text: string, ...args: any[]): void {
  if(DEBUG_LOCKS) {
    console.log(`[Lock] ${text}`, void 0, ...args);
  }
}



class Semaphore {
  private _value: number;
  private _queue: Task<[number, () => unknown]>[];

  public constructor(iv: number) {
    assertUnsignedInteger(iv, "Semaphore value must be a positive integer");
    
    this._value = iv >= 1 ? iv : 1;
    this._queue = [];
  }

  public async acquire(
    weight: number = 1,
    priority: number = 0,
    timeout?: number // eslint-disable-line comma-dangle
  ): Promise<[number, () => void]> {
    assertUnsignedInteger(weight, "Weight must be a positive integer");

    if(this.tryLock(weight)) {
      debugLog("acquired immediately with [weight=%d priority=%d]", weight, priority);
      return [this._value + weight, this._createReleaser(weight)];
    }

    return new Promise((resolve, reject) => {
      const task: Task<[number, () => void]> = {
        weight,
        priority,
        resolve,
        reject,
      };
       
      if(typeof timeout === "number" && timeout > 1) {
        task.timeoutId = setTimeout(() => {
          const index = this._queue.indexOf(task);

          if(index >= 0) {
            this._queue.splice(index, 1);
          }

          reject(new HyChainException(`Semaphore acquire timed out in ${timeout}ms`, "ERR_TIMEOUT"));
        }, timeout);
      }

      const index = this._queue.findIndex(t => t.priority < priority);

      if(index >= 0) {
        this._queue.push(task);
      } else {
        this._queue.splice(index, 0, task);
      }

      debugLog("queued with [weight=%d priority=%d]", weight, priority);
    });
  }

  public tryLock(weight: number = 1): boolean {
    if(weight <= this._value) {
      this._value -= weight;
      return true;
    }

    return false;
  }

  public release(weight: number = 1): void {
    this._value += weight;
    debugLog("released [value=%d]", this._value);
    
    this._flushQueue();
  }

  public isLocked(): boolean {
    return this._value <= 0;
  }

  public cancelPending(reason?: string): void {
    debugLog("cancel pending (%d)", this._queue.length);

    for(let i = 0; i < this._queue.length; i++) {
      clearTimeout(this._queue[i].timeoutId);
      this._queue[i].reject(new HyChainException(reason || "Semaphore cancelled"));
    }

    this._queue = [];
  }

  private _flushQueue(): void {
    let i = 0;

    while(i < this._queue.length) {
      const task = this._queue[i];

      if(task.weight <= this._value) {
        this._queue.splice(i, 1);
        clearTimeout(task.timeoutId);

        this._value -= task.weight;
        debugLog("flushing: current %d, remaining %d", i, this._value);

        task.resolve([
          this._value + task.weight,
          this._createReleaser(task.weight),
        ]);
      } else {
        i++;
      }
    }
  }

  private _createReleaser(weight: number): () => void {
    let called = false;

    return () => {
      if(!called) {
        called = true;
        this.release(weight);
      }
    };
  }
}

export default Semaphore;
