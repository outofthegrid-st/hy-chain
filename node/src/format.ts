/* eslint-disable @typescript-eslint/no-namespace, no-inner-declarations */

import type { Dict } from "@rapid-d-kit/types";

import { HashEntity } from "./crypto/hash";


namespace HyChainFormat {
  export type JsonValue = string | number | boolean | null;

  export type BlockMetadata = Dict<JsonValue>;

  export type BlockId = string;

  export interface BlockHeaders {
    readonly ts: number;
    readonly timestamp: string;
    readonly contentLength: number;
    readonly merkleRoot: HashEntity;
    readonly version: number;
    readonly nonce: number;
  }
  
  export interface ITransaction<TPayload = unknown> {
    readonly payload: TPayload;
    readonly sequence: number;
  }

  export interface IBlock<TPayload = unknown> {
    readonly _id: BlockId;
    readonly publicBlockId: BlockId;
    readonly previousHash: HashEntity;
    readonly sequence: number;
    readonly transaction: ITransaction<TPayload>;
    readonly headers: BlockHeaders;
    readonly metadata: BlockMetadata;
    readonly contentSignature: HashEntity;
    readonly blockSignature: HashEntity;
  }

  export interface IChain {
    // 
  }


  export namespace JSON {
    export type SafeBlock = Omit<IBlock, "previousHash" | "contentSignature" | "headers"> & {
      readonly previousHash: string;
      readonly contentSignature: string;
      readonly headers: Omit<BlockHeaders, "merkleRoot"> & {
        readonly merkleRoot: string;
      };
    };

    export function formatBlock(b: IBlock): SafeBlock {
      return {
        ...b,
        previousHash: b.previousHash.digest("base64"),
        contentSignature: b.contentSignature.digest("base64"),
        headers: {
          ...b.headers,
          merkleRoot: b.headers.merkleRoot.digest("base64"),
        },
      };
    }
  }
}

export default HyChainFormat;
