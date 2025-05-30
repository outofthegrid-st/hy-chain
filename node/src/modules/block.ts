// import { LogarithmicArray } from "array-t";
// import type { BufferLike } from "@rapid-d-kit/types";

// import HyChainFormat from "../format";
// import { IStorage } from "../storage";
// import { HyChainException } from "../errors";
// import { HashEntity, HyChainKeyObject } from "../crypto";


// class Block<TPayload = unknown> implements HyChainFormat.IBlock<TPayload> {
//   static async #UnwrapPayload<T>(input: BufferLike, privateKey: HyChainKeyObject): Promise<T> {
//     //
//   }

//   public static async listAll(storage: IStorage): Promise<LogarithmicArray<HyChainFormat.BlockId>> {
//     try {
//       return (await storage.getAllBlocks())
//         .map(item => item._id);
//     } finally {
//       storage.dispose();
//     }
//   }

//   public static async retrieveAll<T>(storage: IStorage): Promise<LogarithmicArray<Block<T>>> {
//     try {
//       const blocks = await storage.getAllBlocks();
//       const output: LogarithmicArray<Block<T>> = new LogarithmicArray(80);
//       const unwrapTasks: LogarithmicArray<Promise<void>> = new LogarithmicArray(80);
      
//       for(let i = 0; i < blocks.size(); i++) {
//         const task = async () => {
//           // 
//         };

//         unwrapTasks.push(task());
//       }

//       await Promise.all(unwrapTasks);
//     } finally {
//       storage.dispose();
//     }
//   }

//   #immutableState: {
//     readonly privateId: HyChainFormat.BlockId;
//     readonly publicId: HyChainFormat.BlockId;
//     readonly transactions: readonly HyChainFormat.ITransaction<TPayload>[];
//     readonly sequence: number;
//     readonly previousSignature: HashEntity;
//     readonly contentSignature: HashEntity;
//     readonly headers: Readonly<HyChainFormat.BlockHeaders>;
//     readonly blockSignature: HashEntity;
//     readonly metadata: Readonly<HyChainFormat.BlockMetadata>;
//   };

//   readonly #state = {
//     disposed: false,
//   };

//   private constructor(
//     /** Param $0: Private Block ID | Param $1: Public Block ID */
//     _ids: readonly [HyChainFormat.BlockId, HyChainFormat.BlockId],
//     _txs: readonly HyChainFormat.ITransaction<TPayload>[],
//     _blkSeq: number,
//     _prevHSign: HashEntity,
//     _blkCSign: HashEntity,
//     _h: HyChainFormat.BlockHeaders,
//     _blkAsCASign: HashEntity,
//     _meta: HyChainFormat.BlockMetadata // eslint-disable-line comma-dangle
//   ) {
//     this.#immutableState = {
//       privateId: _ids[0],
//       publicId: _ids[1],
//       transactions: _txs,
//       sequence: _blkSeq,
//       previousSignature: _prevHSign,
//       contentSignature: _blkCSign,
//       headers: _h,
//       blockSignature: _blkAsCASign,
//       metadata: _meta,
//     };
//   }

//   public get _id(): HyChainFormat.BlockId {
//     this.#EnsureNotDisposed();
//     return this.#immutableState.privateId;
//   }

//   public get publicBlockId(): HyChainFormat.BlockId {
//     this.#EnsureNotDisposed();
//     return this.#immutableState.publicId;
//   }

//   public get transactions(): readonly HyChainFormat.ITransaction<TPayload>[] {
//     this.#EnsureNotDisposed();
//     return [ ...this.#immutableState.transactions ];
//   }

//   public get sequence(): number {
//     this.#EnsureNotDisposed();
//     return this.#immutableState.sequence;
//   }

//   public get previousHash(): HashEntity {
//     this.#EnsureNotDisposed();
//     return this.#immutableState.previousSignature;
//   }

//   public get contentSignature(): HashEntity {
//     this.#EnsureNotDisposed();
//     return this.#immutableState.contentSignature;
//   }

//   public get headers(): HyChainFormat.BlockHeaders {
//     this.#EnsureNotDisposed();
//     return { ...this.#immutableState.headers };
//   }

//   public get blockSignature(): HashEntity {
//     this.#EnsureNotDisposed();
//     return this.#immutableState.blockSignature;
//   }

//   public get metadata(): HyChainFormat.BlockMetadata {
//     this.#EnsureNotDisposed();
//     return { ...this.#immutableState.metadata };
//   }

//   public dispose(): void {
//     if(!this.#state.disposed) {
//       this.#immutableState = null!;
//       this.#state.disposed = true;
//     }
//   }

//   #EnsureNotDisposed(): void {
//     if(this.#state.disposed) {
//       throw new HyChainException("This block node is already disposed and cannot be used anymore", "ERR_RESOURCE_DISPOSED");
//     }
//   }
// }

// export default Block;
