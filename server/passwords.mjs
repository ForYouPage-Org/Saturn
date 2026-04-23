// Minimal password hashing using node:crypto scrypt. No extra deps.
// Format stored in DB: "<hex-salt>:<hex-hash>". 16-byte salt, 64-byte hash.

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SALT_BYTES = 16;
const HASH_BYTES = 64;

export function hashPassword(password) {
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const hash = scryptSync(password, salt, HASH_BYTES).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (typeof stored !== "string" || !stored.includes(":")) return false;
  const [salt, hashHex] = stored.split(":");
  const expected = Buffer.from(hashHex, "hex");
  const attempt = scryptSync(password, salt, expected.length);
  if (attempt.length !== expected.length) return false;
  return timingSafeEqual(attempt, expected);
}
