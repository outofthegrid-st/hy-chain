/* eslint-disable @typescript-eslint/no-namespace, no-inner-declarations */

import type { Dict } from "@rapid-d-kit/types";

import { HashEntity } from "./crypto/hash";


namespace HyChainFormat {
  export type JsonValue = string | number | boolean | null;

  export interface BlockHeaders {
    readonly ts: number;
    readonly timestamp: string;
    readonly contentLength: number;
  }
  
  export interface ITransaction<TPayload = unknown> {
    readonly payload: TPayload;
    readonly sequence: number;
  }

  export interface IBlock<TPayload = unknown> {
    readonly previousHash: HashEntity;
    readonly sequence: number;
    readonly transaction: ITransaction<TPayload>;
    readonly headers: BlockHeaders;
    readonly metadata: Dict<JsonValue>;
    readonly contentSignature: HashEntity;
  }

  export interface IChain {
    // 
  }


  export namespace JSON {
    export type SafeBlock = Omit<IBlock, "previousHash" | "contentSignature"> & {
      readonly previousHash: string;
      readonly contentSignature: string;
    };

    export function formatBlock(b: IBlock): SafeBlock {
      return {
        ...b,
        previousHash: b.previousHash.digest("base64"),
        contentSignature: b.contentSignature.digest("base64"),
      };
    }
  }
}

export default HyChainFormat;
