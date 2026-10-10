import crypto from "crypto";

export interface SessionPayload {
  userId: string;
  email: string;
  createdAt: number;
}

export const SESSION_COOKIE_NAME = "myattendance_session";

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return "default_myattendance_jwt_secret_key_32_characters_minimum";
  }
  return secret;
}

/**
 * Creates a cryptographically signed HMAC-SHA256 session token.
 */
export function signSessionToken(payload: SessionPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", getSecret()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

/**
 * Validates a session token and returns the session payload if authentic and unexpired.
 */
export function verifySessionToken(token: string): SessionPayload | null {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return null;
  }

  const [data, sig] = token.split(".");
  if (!data || !sig) return null;

  try {
    const expectedSig = crypto.createHmac("sha256", getSecret()).update(data).digest("base64url");

    // Timing-safe comparison to prevent timing attacks
    const sigBuffer = Buffer.from(sig);
    const expectedBuffer = Buffer.from(expectedSig);

    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as SessionPayload;

    // 30-day session lifetime
    const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
    if (Date.now() - payload.createdAt > MAX_AGE_MS) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
