// Minimal password hashing with node:crypto scrypt. No extra deps.
// Stored format: "<hex-salt>:<hex-hash>". 16-byte salt, 64-byte hash.

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SALT_BYTES = 16;
const HASH_BYTES = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const hash = scryptSync(password, salt, HASH_BYTES).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hashHex] = stored.split(":");
  const expected = Buffer.from(hashHex, "hex");
  const attempt = scryptSync(password, salt, expected.length);
  if (attempt.length !== expected.length) return false;
  return timingSafeEqual(attempt, expected);
}
