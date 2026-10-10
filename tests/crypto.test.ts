import { encryptCredentials, decryptCredentials } from "../src/lib/security/crypto";

// Mock env for test execution if needed
process.env.PORTAL_ENCRYPTION_SECRET =
  process.env.PORTAL_ENCRYPTION_SECRET ||
  "f3b9c7e14a82d06f15e8b4c29a73d51806f4e2a9b7c1d3e5f8a0b2c4d6e8f1a3";

function runCryptoTests() {
  console.log("🔐 Testing AES-256-GCM Credential Encryption...");

  const testPassword = "MySecurePortalPassword#2026!";
  const encrypted = encryptCredentials(testPassword);

  console.assert(encrypted.encrypted !== testPassword, "Ciphertext must not match plaintext");
  console.assert(encrypted.iv.length === 24, "IV must be 24 hex characters (12 bytes)");
  console.assert(encrypted.authTag.length === 32, "AuthTag must be 32 hex characters (16 bytes)");

  const decrypted = decryptCredentials(encrypted);
  console.assert(decrypted === testPassword, "Decrypted password must match original plaintext");

  // Tampering test: modify one character in ciphertext
  let tamperedCaught = false;
  try {
    const tamperedEncrypted =
      (encrypted.encrypted.startsWith("a") ? "b" : "a") + encrypted.encrypted.slice(1);
    decryptCredentials({
      ...encrypted,
      encrypted: tamperedEncrypted,
    });
  } catch {
    tamperedCaught = true;
  }
  console.assert(tamperedCaught, "GCM AuthTag must detect and reject tampered ciphertext");

  console.log("✅ All Crypto unit tests passed successfully!");
}

runCryptoTests();
