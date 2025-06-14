import { timestamp } from "ndforge/timer";
import { randomBytes } from "node:crypto";
import { strShuffle } from "ndforge/@internals/util";


export function uuidv7(): string {
  const ts = BigInt(timestamp());
  const timeHex = ts.toString(16).padStart(12, "0");

  const randomBytesArray = randomBytes(13);

  // UUID v7 format: time-based 48 bits + version 4 bits + random 74 bits
  const uuid = [
    // Time high and version (combine the high 12 bits of time with version 7)
    timeHex.substring(0, 8),
    timeHex.substring(8, 12), // Time low
    `7${randomBytesArray[0].toString(16).padStart(2, "0").slice(1)}${randomBytesArray.subarray(1, 3).toString("hex")}`, // Version 7
    randomBytesArray.subarray(3, 6).toString("hex"), // Random part
    randomBytesArray.subarray(6).toString("hex"), // Remaining random bytes
  ];

  return uuid.join("-").toLowerCase();
}


export function shortId(length: number = 12, special: boolean = false): string {
  // Make sure the alphabet always has 62 characters
  const ALPHABET = ("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz" + (special ? "-_" : ""));

  const buffer = randomBytes(Math.ceil(length * Math.log2(ALPHABET.length) / 8));
  let value = BigInt(`0x${buffer.toString("hex")}`);

  let result = "";

  while(value > 0) {
    result = ALPHABET[Number(value % BigInt(ALPHABET.length))] + result;
    value = value / BigInt(ALPHABET.length);
  }

  return result;
}


export function longId(): string {
  const ts = BigInt(timestamp());

  const timeHex = ts.toString(16).padStart(12, "0");
  const random = randomBytes(13).toString("hex");

  return `${timeHex}${strShuffle(`${random}${shortId(24, true)}`)}`;
}
