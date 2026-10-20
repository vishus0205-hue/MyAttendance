import { ConnectionTestResult } from "./portal-adapter.interface";

/** Classify only visible portal error messages; hidden scripts and generic page text are not evidence. */
export function classifyPortalLogin(
  visibleErrorText: string,
  hasAuthenticatedNavigation: boolean,
  studentName?: string
): ConnectionTestResult {
  if (hasAuthenticatedNavigation) {
    return {
      success: true,
      message: "Authentication successful with SVKM SAP Portal",
      studentName,
    };
  }
  if (/user authentication failed|logon failed|invalid user(?:name| name) or password|client, user, or password is incorrect/i.test(visibleErrorText)) {
    return {
      success: false,
      errorCode: "INVALID_CREDENTIALS",
      message: "The SVKM portal rejected this Student ID and password.",
    };
  }
  if (/password has expired|user is locked/i.test(visibleErrorText)) {
    return {
      success: false,
      errorCode: "ACCOUNT_ACTION_REQUIRED",
      message: "The SVKM portal requires an account action. Sign in there to resolve it, then try again.",
    };
  }
  return {
    success: false,
    errorCode: "VERIFICATION_UNAVAILABLE",
    message: "The SVKM portal did not confirm the login. Please try again shortly.",
  };
}
