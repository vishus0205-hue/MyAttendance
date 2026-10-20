import assert from "node:assert/strict";
import { signSessionToken, verifySessionToken } from "../src/lib/auth/token";
import { parsePdfAttendanceItems } from "../src/services/portal/pdf-attendance-parser";
import { classifyPortalLogin } from "../src/services/portal/portal-login-result";

const previousSecret = process.env.AUTH_SECRET;
try {
  delete process.env.AUTH_SECRET;
  assert.throws(
    () => signSessionToken({ userId: "u1", email: "student@example.com", createdAt: Date.now() }),
    /AUTH_SECRET must be configured/
  );

  process.env.AUTH_SECRET = "a-long-secret-with-at-least-32-characters";
  const token = signSessionToken({ userId: "u1", email: "student@example.com", createdAt: Date.now() });
  assert.equal(verifySessionToken(token)?.userId, "u1");
} finally {
  if (previousSecret === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = previousSecret;
}

const validPdfText = "1\nMathematics\nJan 12, 2026\nAM\nP\n";
assert.deepEqual(parsePdfAttendanceItems(validPdfText), [
  { date: "Jan 12, 2026", subjectName: "Mathematics", status: "P" },
]);
assert.throws(
  () => parsePdfAttendanceItems("1\nMathematics\nJan 12, 2026\nAM\nUnreadable\n"),
  /missing a recognizable subject or status/
);
assert.throws(() => parsePdfAttendanceItems("unrecognized PDF layout"), /no recognizable attendance dates/);

assert.equal(classifyPortalLogin("Welcome, Student", true, "Student").success, true);
assert.equal(classifyPortalLogin("User authentication failed", false).errorCode, "INVALID_CREDENTIALS");
assert.equal(classifyPortalLogin("Password has expired", false).errorCode, "ACCOUNT_ACTION_REQUIRED");
assert.equal(classifyPortalLogin("Login submitted", false).errorCode, "VERIFICATION_UNAVAILABLE");
assert.equal(classifyPortalLogin("User authentication failed", true).success, true);

console.log("Security regression tests passed.");
