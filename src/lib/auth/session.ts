import { cookies } from "next/headers";
import { prisma } from "../db/prisma";
import { verifySessionToken, SESSION_COOKIE_NAME } from "./token";

export interface AppUserSession {
  id: string;
  studentId?: string | null;
  email: string;
  name: string;
  targetThreshold: number;
}

/**
 * Resolves the authenticated user for API routes and server components.
 * Strictly scopes all operations to the verified logged-in user ID.
 */
export async function getAuthenticatedUser(): Promise<AppUserSession> {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    const payload = verifySessionToken(token);
    if (payload?.userId) {
      // Query the database to retrieve live profile data (name, email, threshold)
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (user) {
        return {
          id: user.id,
          studentId: user.studentId || payload.studentId || null,
          email: user.email,
          name: user.name && user.name !== "Student" ? user.name : (payload.name && payload.name !== "Student" ? payload.name : user.name || "Student"),
          targetThreshold: user.targetThreshold,
        };
      }
    }
  }

  throw new Error("Unauthorized. Please log in to your account.");
}

/**
 * Optional session resolver that returns null instead of throwing when unauthenticated.
 */
export async function getOptionalUser(): Promise<AppUserSession | null> {
  try {
    return await getAuthenticatedUser();
  } catch {
    return null;
  }
}
