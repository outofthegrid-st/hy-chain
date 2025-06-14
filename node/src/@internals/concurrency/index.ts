import Mutex from "./mutex";

export { default as Mutex } from "./mutex";
export { enableLockDebug, default as Semaphore } from "./semaphore";


const glocks = new Map<string, Mutex>();


export class NamedLock {
  public static getLock(name: string): Mutex {
    if(!glocks.has(name)) {
      glocks.set(name, new Mutex());
    }

    return glocks.get(name)!;
  }

  public static releaseLock(name: string): void {
    if(glocks.has(name)) {
      glocks.get(name)!.cancel();
    }

    glocks.delete(name);
  }

  public static clear(): void {
    for(const m of glocks.values()) {
      m.cancel();
    }

    glocks.clear();
  }
}
