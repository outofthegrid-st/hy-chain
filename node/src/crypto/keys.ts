import * as crypto from "node:crypto";
import { IDisposable } from "@rapid-d-kit/disposable";
import type { BufferLike, MaybePromise } from "@rapid-d-kit/types";
import { CancellationToken, ICancellationToken } from "@rapid-d-kit/async";
import { type EntropyBufferRequest, type EntropyDevice, generateRandomBytes } from "ndforge";

import { BufferReader, chunkToBuffer } from "../@internals/binary-protocol";
import { HyChainException, HyChainNotImplementedException } from "../errors";


export type KnownAlgorithm = 
  | "RSA"
  | "ECDSA"
  | "Ed25519"
  | "SHA256"
  | "SHA384"
  | "SHA512"
  | "AES-CBC-128"
  | "AES-CBC-256"
  | "AES-GCM-128"
  | "AES-GCM-256"
  | "AES-CCM-128"
  | "AES-CCM-256"
  | "CHACHA20";


export type Alg = {
  kind:  "secret" | "public" | "private";
  length: number;
  ivLength?: number | undefined;
  authTagLength?: number | undefined;
  name?: string | undefined;
};


export interface KeyDetails {
  label: BufferLike;
  userId?: BufferLike | undefined;
}


export type KeyInfo = KeyDetails & Alg & Partial<Omit<crypto.AsymmetricKeyDetails, "publicExponent"> & {
  publicExponent?: number | bigint | string | undefined;
}>;


export interface IKey extends IDisposable {
  getDetails(): KeyDetails;
  setDetails(o: Partial<KeyDetails>): IKey;
  read(length?: number | null | undefined): Buffer;
  armor(): MaybePromise<Buffer>;
}


export type KeyReaderOptions = {
  inputFormat?: "armored" | "base64" | "hex" | "pem" | "raw" | undefined;
  algorithm?: KnownAlgorithm | Alg | undefined;
};


const DEFAULT_RSA_MODULUS_LENGTH = 2048;
const STANDARD_HASING_LENGTH = 256;


class HyChainKeyObject implements IKey {
  readonly #keyMaterial: BufferReader;

  #details: KeyDetails;
  #asymmetricDetails?: crypto.AsymmetricKeyDetails;
  #algorithm: Alg;

  #state = {
    disposed: false,
    format: "raw" as NonNullable<KeyReaderOptions["inputFormat"]>,
  };

  private constructor(
    _source: BufferLike,
    _format: NonNullable<KeyReaderOptions["inputFormat"]>,
    _algorithm: Alg,
    _details?: KeyDetails,
    _asymmetricDetails?: crypto.AsymmetricKeyDetails // eslint-disable-line comma-dangle
  ) {
    this.#keyMaterial = new BufferReader( chunkToBuffer(_source) );
    
    this.#algorithm = _algorithm;
    this.#details = _details ?? { label: "$$default" };
    this.#asymmetricDetails = _asymmetricDetails;

    this.#state.format = _format || "raw";
  }

  public getInfo(): KeyInfo {
    this.#EnsureNotDisposed();

    return {
      ...this.#details,
      ...this.#algorithm,
      ...this.#asymmetricDetails,
      publicExponent: typeof this.#asymmetricDetails?.publicExponent === "bigint" ?
        `bigint:${this.#asymmetricDetails.publicExponent.toString()}` : void 0,
    };
  }

  public getDetails(): KeyDetails {
    this.#EnsureNotDisposed();
    return { ...this.#details };
  }

  public setDetails(o: Partial<KeyDetails>): this {
    this.#EnsureNotDisposed();

    this.#details = {
      ...this.#details,
      ...o,
    };

    return this;
  }

  public read(length?: number | null | undefined): Buffer {
    this.#EnsureNotDisposed();
    return this.#keyMaterial.read(length ?? void 0);
  }

  public armor(): Promise<Buffer> {
    throw new HyChainNotImplementedException("HyChainKeyObject#armor()");
  }

  public master(): Buffer {
    this.#EnsureNotDisposed();

    if(this.#algorithm.kind === "secret")
      return this.#keyMaterial.buffer.subarray(0, this.#algorithm.length);

    return this.#keyMaterial.buffer;
  }

  public iv(): Buffer | null {
    this.#EnsureNotDisposed();

    if(this.#algorithm.kind !== "secret")
      return null;

    return null; // Not Implemented Yet
  }

  public authTag(): Buffer | null {
    this.#EnsureNotDisposed();

    if(this.#algorithm.kind !== "secret")
      return null;

    return null; // Not Implemented Yet
  }

  public collectAuthTag(tag: BufferLike): this {
    this.#EnsureNotDisposed();

    if(this.#algorithm.kind !== "secret") {
      throw new HyChainException("Cannot collect auth tag for an asymmetric key", "ERR_UNSUPPORTED_OPERATION");
    }

    void tag;
    return this;
  }

  public leftBuffer(): Buffer | null {
    this.#EnsureNotDisposed();

    if(this.#algorithm.kind !== "secret")
      return null;

    return null; // Not Implemented Yet
  }

  public dispose(): void {
    if(!this.#state.disposed) {
      this.#keyMaterial.dispose();
      this.#state.disposed = true;
    }
  }

  #EnsureNotDisposed(): void {
    if(this.#state.disposed) {
      throw new HyChainException("Key object is already disposed and cannot be used anymore", "ERR_RESOURCE_DISPOSED");
    }
  }

  public static generateAsymmetricKeyPair(
    algorithm: "RSA" | "ECDSA" | "Ed25519",
    o?: crypto.AsymmetricKeyDetails & {
      paramEncoding?: "explicit" | "named"
    } // eslint-disable-line comma-dangle
  ): Promise<readonly [HyChainKeyObject, HyChainKeyObject]> {
    switch(algorithm) {
      case "RSA": {
        let mLength = o?.modulusLength ?? DEFAULT_RSA_MODULUS_LENGTH;

        if(![DEFAULT_RSA_MODULUS_LENGTH, DEFAULT_RSA_MODULUS_LENGTH * 2].includes(mLength)) {
          mLength = DEFAULT_RSA_MODULUS_LENGTH;
        }

        return new Promise((resolve, reject) => {
          crypto.generateKeyPair("rsa", {
            modulusLength: mLength,
            publicExponent: typeof o?.publicExponent === "number" ? o.publicExponent : void 0,
          }, (err, pko, sko) => {
            // eslint-disable-next-line no-extra-boolean-cast
            if(!!err) return reject(err);
            
            const publicKey = new HyChainKeyObject(
              pko.export({ format: "der", type: "pkcs1" }),
              "raw",
              { kind: "public", name: (pko.asymmetricKeyType ?? "RSA").toUpperCase(), length: mLength },
              void 0,
              {
                ...{ publicExponent: o?.publicExponent, modulusLength: mLength },
                ...pko.asymmetricKeyDetails,
              } // eslint-disable-line comma-dangle
            );

            const privateKey = new HyChainKeyObject(
              sko.export({ format: "der", type: "pkcs1" }),
              "raw",
              { kind: "private", name: (sko.asymmetricKeyType ?? "RSA").toUpperCase(), length: mLength },
              void 0,
              {
                ...{ publicExponent: o?.publicExponent, modulusLength: mLength },
                ...sko.asymmetricKeyDetails,
              } // eslint-disable-line comma-dangle
            );

            resolve([ publicKey, privateKey ]);
          });
        });
      } break;
    
      case "ECDSA": {
        return new Promise((resolve, reject) => {
          crypto.generateKeyPair("ec", {
            namedCurve: "secp256k1",
            paramEncoding: o?.paramEncoding,
          }, (err, pko, sko) => {
            // eslint-disable-next-line no-extra-boolean-cast
            if(!!err) return reject(err);

            const publicKey = new HyChainKeyObject(
              pko.export({ format: "der", type: "spki" }),
              "raw",
              { kind: "public", name: (pko.asymmetricKeyType ?? "ECDSA").toUpperCase(), length: 33 },
              void 0,
              pko.asymmetricKeyDetails // eslint-disable-line comma-dangle
            );

            const privateKey = new HyChainKeyObject(
              sko.export({ format: "der", type: "sec1" }),
              "raw",
              { kind: "private", name: (sko.asymmetricKeyType ?? "ECDSA").toUpperCase(), length: 32 },
              void 0,
              sko.asymmetricKeyDetails // eslint-disable-line comma-dangle
            );

            resolve([ publicKey, privateKey ]);
          });
        });
      } break;

      case "Ed25519": {
        return new Promise((resolve, reject) => {
          crypto.generateKeyPair("ed25519",
            { },
            (err, pko, sko) => {
              // eslint-disable-next-line no-extra-boolean-cast
              if(!!err) return reject(err);

              const publicKey = new HyChainKeyObject(
                pko.export({ format: "der", type: "spki" }),
                "raw",
                { kind: "public", name: (pko.asymmetricKeyType ?? "ed25519").toUpperCase(), length: 32 },
                void 0,
                pko.asymmetricKeyDetails // eslint-disable-line comma-dangle
              );

              const privateKey = new HyChainKeyObject(
                sko.export({ format: "der", type: "pkcs8" }),
                "raw",
                { kind: "private", name: (sko.asymmetricKeyType ?? "ed25519").toUpperCase(), length: 32 },
                void 0,
                sko.asymmetricKeyDetails // eslint-disable-line comma-dangle
              );

              resolve([ publicKey, privateKey ]);
            });
        });
      } break;
    }
  }

  public static async generateSymmetricKey(
    algorithm: Exclude<KnownAlgorithm, "RSA" | "ECDSA" | "Ed25519"> | Alg,
    entropy?: EntropyDevice | EntropyBufferRequest,
    token: ICancellationToken = CancellationToken.None // eslint-disable-line comma-dangle
  ): Promise<HyChainKeyObject> {
    if(token.isCancellationRequested) {
      throw new HyChainException("Symmetric key generation was cancelled by token", "ERR_TOKEN_CANCELLED");
    }

    const { length, ivLength = 0, authTagLength = 0 } = _getAlgorithmLenghts(algorithm);
    const finalLength = length + ivLength + authTagLength;

    let buffer: Buffer;

    if(!entropy) {
      buffer = await generateRandomBytes(finalLength, token);
    } else {
      buffer = await generateRandomBytes(finalLength, entropy, token);
    }

    const algorithmName = typeof algorithm === "string" ? algorithm : algorithm.name;

    if(token.isCancellationRequested) {
      throw new HyChainException("Symmetric key generation was cancelled by token", "ERR_TOKEN_CANCELLED");
    }

    return new HyChainKeyObject(
      buffer,
      "raw",
      { kind: "secret", length, authTagLength, ivLength, name: algorithmName } // eslint-disable-line comma-dangle
    );
  }
}


function _getAlgorithmLenghts(algorithm: Exclude<KnownAlgorithm, "RSA" | "ECDSA" | "Ed25519"> | Alg): {
  length: number;
  ivLength?: number;
  authTagLength?: number;
} {
  if(typeof algorithm === "object") return {
    length: algorithm.length,
    ivLength: algorithm.ivLength,
    authTagLength: algorithm.authTagLength,
  };

  switch(algorithm) {
    case "SHA256":
    case "SHA384":
    case "SHA512": {
      return { length: STANDARD_HASING_LENGTH };
    } break;
    
    case "AES-CBC-128": {
      return { length: 16, ivLength: 16 };
    } break;

    case "AES-CBC-256": {
      return { length: 32, ivLength: 16 };
    } break;

    case "AES-GCM-128": {
      return { length: 16, ivLength: 12, authTagLength: 16 };
    } break;

    case "AES-GCM-256": {
      return { length: 32, ivLength: 12, authTagLength: 16 };
    } break;

    case "AES-CCM-128": {
      return { length: 16, ivLength: 12, authTagLength: 16 };
    } break;

    case "AES-CCM-256": {
      return { length: 32, ivLength: 12, authTagLength: 16 };
    } break;

    case "CHACHA20": {
      return { length: 32, ivLength: 12 };
    } break;
    default: {
      throw new HyChainException(`Unable to generate a key for unknown algorithm '${algorithm}'`, "ERR_INVALID_ARGUMENT");
    } break;
  }
}


export default HyChainKeyObject;
