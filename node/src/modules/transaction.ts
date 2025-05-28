import HyChainFormat from "../format";
import { HyChainException } from "../errors";


class Transaction<TPayload = unknown> implements HyChainFormat.ITransaction<TPayload> {
  readonly #payload: TPayload;

  readonly #state: {
    readonly sequence: number;
    disposed: boolean;
  };

  public constructor(
    payload: TPayload,
    seq: number,
    // options?: unknown // eslint-disable-line comma-dangle
  ) {
    this.#payload = payload;

    this.#state = {
      sequence: seq,
      disposed: false,
    };
  }

  public get payload(): TPayload {
    this.#EnsureNotDisposed();
    return this.#payload;
  }

  public get sequence(): number {
    this.#EnsureNotDisposed();
    return this.#state.sequence;
  }

  public toJSON(): HyChainFormat.ITransaction<TPayload> {
    this.#EnsureNotDisposed();

    return {
      payload: this.#payload,
      sequence: this.#state.sequence,
    };
  }

  #EnsureNotDisposed(): void {
    if(this.#state.disposed) {
      throw new HyChainException("This transaction node is already disposed and cannot be used anymore", "ERR_RESOURCE_DISPOSED");
    }
  }
}

export default Transaction;
