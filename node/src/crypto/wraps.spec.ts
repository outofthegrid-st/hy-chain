import { armor, dearmor } from "./wraps";
import { HyChainException } from "../errors";
import { BufferWriter } from "../@internals/binary-protocol";


const TEST_KEY = Buffer.concat([
  Buffer.alloc(16, 1), // Master Key: 16 bytes of 0x01
  Buffer.alloc(16, 2), // IV: 16 bytes of 0x02
]);

const PLAINTEXT = Buffer.from("Hello, HyChain!");


describe("armor and dearmor", () => {
  test("armor and dearmor without encryption", () => {
    const armored = armor(false, PLAINTEXT);
    expect(armored).toBeInstanceOf(Buffer);

    const dearmored = dearmor(armored);
    expect(dearmored.equals(PLAINTEXT)).toBe(true);
  });

  test("armor and dearmor with encryption", () => {
    const armored = armor(true, PLAINTEXT, TEST_KEY);
    expect(armored).toBeInstanceOf(Buffer);

    const dearmored = dearmor(armored, TEST_KEY);
    expect(dearmored.equals(PLAINTEXT)).toBe(true);
  });

  test("armor and dearmor with base64 encoding", () => {
    const armored = armor(true, PLAINTEXT, TEST_KEY, "base64");
    expect(typeof armored).toBe("string");

    const dearmored = dearmor(armored, TEST_KEY, "base64");
    expect(dearmored.equals(PLAINTEXT)).toBe(true);
  });

  test("dearmor throws on invalid magic header", () => {
    const invalidBuffer = Buffer.from("INVALID_DATA");

    expect(() => {
      dearmor(invalidBuffer);
    }).toThrow(HyChainException);
  });

  test("dearmor throws on invalid flag", () => {
    const writer = new BufferWriter();

    // correct magic header
    writer.write(Buffer.from([
      0x48, 0x59, 0x20, 0x43, 0x48,
      0x41, 0x49, 0x4E, 0x20, 0x41,
      0x52, 0x4D, 0x4F, 0x52, 0x45,
      0x44, 0x20, 0x4B, 0x45, 0x59,
    ]));

    writer.write(new Uint8Array([99])); // invalid flag
    writer.write(PLAINTEXT);

    const buffer = writer.drain();

    expect(() => {
      dearmor(buffer);
    }).toThrow(HyChainException);
  });

  test("parseKey throws when key is too short", () => {
    const shortKey = Buffer.alloc(10); // too short

    expect(() => {
      armor(true, PLAINTEXT, shortKey);
    }).toThrow(HyChainException);
  });
});
