import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // Standard for AES-GCM (96 bits)

/**
 * Returns the encryption key buffer from environment variables.
 * Validates that PORTAL_ENCRYPTION_SECRET is exactly 64 hex characters (32 bytes).
 */
function getEncryptionKey(): Buffer {
  const secretHex = process.env.PORTAL_ENCRYPTION_SECRET;
  if (!secretHex || secretHex.length !== 64) {
    throw new Error(
      "PORTAL_ENCRYPTION_SECRET must be a 64-character hex string (32 bytes). Please check your .env file."
    );
  }
  return Buffer.from(secretHex, "hex");
}

export interface EncryptedPayload {
  encrypted: string; // Hex encoded ciphertext (or packed "iv:authTag:ciphertext")
  iv?: string;       // Hex encoded IV (24 chars)
  authTag?: string;  // Hex encoded authentication tag (32 chars)
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Stores the field's own IV and AuthTag packed with the ciphertext so that
 * multiple fields (like username and password) never collide on IV/AuthTag.
 */
export function encryptCredentials(plainText: string): {
  encrypted: string;
  iv: string;
  authTag: string;
} {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encryptedHex = cipher.update(plainText, "utf8", "hex");
  encryptedHex += cipher.final("hex");
  const authTagHex = cipher.getAuthTag().toString("hex");
  const ivHex = iv.toString("hex");

  // Pack as iv:authTag:ciphertext to make every field self-contained
  const packedCiphertext = `${ivHex}:${authTagHex}:${encryptedHex}`;

  return {
    encrypted: packedCiphertext,
    iv: ivHex,
    authTag: authTagHex,
  };
}

/**
 * Decrypts an AES-256-GCM encrypted payload or string.
 * Supports both packed format ("iv:authTag:ciphertext") and separate object fields.
 */
export function decryptCredentials(payload: EncryptedPayload | string): string {
  const key = getEncryptionKey();

  let ivHex = "";
  let authTagHex = "";
  let ciphertextHex = "";

  if (typeof payload === "string") {
    const parts = payload.split(":");
    if (parts.length === 3) {
      ivHex = parts[0];
      authTagHex = parts[1];
      ciphertextHex = parts[2];
    } else {
      throw new Error("Invalid packed encrypted string format");
    }
  } else {
    // If the encrypted field itself is in packed format:
    if (payload.encrypted && payload.encrypted.includes(":")) {
      const parts = payload.encrypted.split(":");
      if (parts.length === 3) {
        ivHex = parts[0];
        authTagHex = parts[1];
        ciphertextHex = parts[2];
      }
    } else {
      ivHex = payload.iv || "";
      authTagHex = payload.authTag || "";
      ciphertextHex = payload.encrypted || "";
    }
  }

  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error("Missing IV, AuthTag, or Ciphertext for decryption");
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertextHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Mask sensitive string for safe logging (e.g. "AB****12")
 */
export function maskSensitive(text: string): string {
  if (!text || text.length <= 4) return "****";
  const start = text.slice(0, 2);
  const end = text.slice(-2);
  return `${start}****${end}`;
}
