import * as crypto from "node:crypto";
import { CancellationToken, CancellationTokenSource } from "@rapid-d-kit/async";

import { sign, HashEntity } from "./hash";
import { HyChainException } from "../errors";


describe("sign function", () => {
  const content = Buffer.from("Test content");

  const algorithms = [
    "HMAC-SHA256",
    "ECDSA-SHA256",
    "RSA-SHA512",
    "Ed25519",
  ] as const;

  const hmacKey = crypto.randomBytes(32);

  const { privateKey: ecdsaPrivateKey } = crypto.generateKeyPairSync("ec", {
    namedCurve: "secp256k1",
  });

  const { privateKey: rsaPrivateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });

  const { privateKey: edPrivateKey } = crypto.generateKeyPairSync("ed25519");

  const keyMap = {
    "HMAC-SHA256": hmacKey,
    "ECDSA-SHA256": ecdsaPrivateKey.export({ type: "pkcs8", format: "pem" }),
    "RSA-SHA512": rsaPrivateKey.export({ type: "pkcs8", format: "pem" }),
    "Ed25519": edPrivateKey.export({ type: "pkcs8", format: "pem" }),
  } as const;

  algorithms.forEach(algorithm => {
    test(`should correctly sign using ${algorithm}`, async () => {
      const key = keyMap[algorithm];

      const result = await sign(
        algorithm,
        content,
        key,
        algorithm === "Ed25519",
        CancellationToken.None // eslint-disable-line comma-dangle
      );

      expect(result).toBeInstanceOf(HashEntity);
      expect(result.byteLength).toBeGreaterThan(0);

      const buffer = result.buffer();
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });

  test("should throw error on unknown algorithm", async () => {
    await expect(sign(
      "UNKNOWN" as any,
      content,
      hmacKey,
      false,
      CancellationToken.None // eslint-disable-line comma-dangle
    )).rejects.toThrow("Unable to sign content with unknown algorithm");
  });

  test("should support cancellation", async () => {
    const source = new CancellationTokenSource();
    source.cancel();

    await expect(sign(
      "HMAC-SHA256",
      content,
      hmacKey,
      false,
      source.token // eslint-disable-line comma-dangle

      // buffer extraction method depends on cancellation token because it's source can be a promise...
    )).rejects.toThrow("Asynchronous buffer digest was cancelled by token");
  });
});

describe("HashEntity", () => {
  const content = Buffer.from("Hello, HashEntity!");

  let hashEntity: HashEntity;

  beforeEach(() => {
    hashEntity = new HashEntity(content);
  });

  afterEach(() => {
    hashEntity?.dispose?.();
  });

  test("should return correct byteLength", () => {
    expect(hashEntity.byteLength).toBe(Buffer.byteLength(content as Buffer));
  });

  test("should return correct digest in hex", () => {
    const digest = hashEntity.digest("hex");
    const expected = (content as Buffer).toString("hex");

    expect(digest).toBe(expected);
  });

  test("should return correct bytes as Uint8Array", () => {
    const bytes = hashEntity.bytes();

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(bytes)).toEqual(content);
  });

  test("should return correct buffer", () => {
    const buffer = hashEntity.buffer();

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer).toEqual(content);
  });

  test("should return correct ArrayBuffer", () => {
    const arrayBuffer = hashEntity.arrayBuffer();
    const view = new Uint8Array(arrayBuffer);

    expect(Buffer.from(view)).toEqual(content);
  });

  test("should read the entire buffer correctly", () => {
    const readBuffer = hashEntity.read();
    expect(readBuffer).toEqual(content);
  });

  test("should read a specific length correctly", () => {
    const length = 5;
    const readBuffer = hashEntity.read(length);

    expect(readBuffer).toEqual((content as Buffer).subarray(0, length));
    expect(hashEntity.buffer()).toEqual((content as Buffer).subarray(length));
  });

  test("should dispose and prevent further use", () => {
    hashEntity.dispose();

    expect(() => hashEntity.byteLength).toThrow(HyChainException);
    expect(() => hashEntity.digest("hex")).toThrow("Hash entity is already disposed");
    expect(() => hashEntity.read()).toThrow(HyChainException);
  });

  test("dispose should be idempotent", () => {
    expect(() => hashEntity.dispose()).not.toThrow();
    expect(() => hashEntity.dispose()).not.toThrow();
  });
});
