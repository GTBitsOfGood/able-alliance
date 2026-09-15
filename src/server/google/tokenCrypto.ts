/**
 * Symmetric encryption for Google OAuth refresh tokens at rest.
 *
 * Refresh tokens are long-lived credentials to a user's personal calendar, so
 * they are never stored in plaintext. AES-256-GCM gives us confidentiality plus
 * an auth tag, so a tampered ciphertext fails to decrypt instead of silently
 * producing garbage.
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96-bit nonce, the size recommended for GCM
const KEY_BYTES = 32;
const VERSION = "v1";

let cachedKey: Buffer | null = null;

/**
 * Parse GOOGLE_TOKEN_ENCRYPTION_KEY into a 32-byte key.
 * Accepts either 64 hex characters or base64 that decodes to 32 bytes.
 */
function getKey(): Buffer {
  if (cachedKey) {
    return cachedKey;
  }

  const raw = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "GOOGLE_TOKEN_ENCRYPTION_KEY environment variable is required to store Google refresh tokens",
    );
  }

  let key: Buffer | null = null;
  if (/^[0-9a-f]{64}$/i.test(raw)) {
    key = Buffer.from(raw, "hex");
  } else {
    const decoded = Buffer.from(raw, "base64");
    if (decoded.length === KEY_BYTES) {
      key = decoded;
    }
  }

  if (!key || key.length !== KEY_BYTES) {
    throw new Error(
      "GOOGLE_TOKEN_ENCRYPTION_KEY must be 32 bytes (64 hex chars or base64). Generate one with: openssl rand -hex 32",
    );
  }

  cachedKey = key;
  return key;
}

/** Encrypt a refresh token into a self-describing "v1:iv:tag:ciphertext" string. */
export function encryptToken(plaintext: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

/** Reverse of {@link encryptToken}. Throws if the payload was tampered with. */
export function decryptToken(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Malformed encrypted token payload");
  }

  const [, ivB64, tagB64, ciphertextB64] = parts;
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** True when the encryption key is configured — used to fail fast with a clear message. */
export function isTokenEncryptionConfigured(): boolean {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}
