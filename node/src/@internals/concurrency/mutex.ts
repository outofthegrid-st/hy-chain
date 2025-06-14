import Semaphore from "./semaphore";


class Mutex {
  private readonly _semaphore: Semaphore = new Semaphore(1);

  public async acquire(priority: number = 0, timeout?: number): Promise<() => void> {
    const [, release] = await this._semaphore.acquire(1, priority, timeout);
    return release;
  }

  public async runExclusive<T>(
    callback: () => T | Promise<T>,
    priority: number = 0,
    timeout?: number // eslint-disable-line comma-dangle
  ): Promise<T> {
    const release = await this.acquire(priority, timeout);

    try {
      return await callback();
    } finally {
      release();
    }
  }

  public tryLock(): boolean {
    return this._semaphore.tryLock(1);
  }

  public isLocked(): boolean {
    return this._semaphore.isLocked();
  }

  public release(): void {
    this._semaphore.release(1);
  }

  public cancel(): void {
    this._semaphore.cancelPending();
  }
}

export default Mutex;
