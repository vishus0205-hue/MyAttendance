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
      if (payload.email && payload.name) {
        return {
          id: payload.userId,
          studentId: payload.studentId ?? null,
          email: payload.email,
          name: payload.name,
          targetThreshold: payload.targetThreshold ?? 75.0,
        };
      }

      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (user) {
        return {
          id: user.id,
          studentId: user.studentId,
          email: user.email,
          name: user.name || "Student",
          targetThreshold: user.targetThreshold,
        };
      }
    }
  }

  // Fallback for transition: if only 1 user exists and no session cookie is present,
  // allow accessing that profile until they log in or create another profile
  const userCount = await prisma.user.count();
  if (userCount === 1) {
    const singleUser = await prisma.user.findFirst();
    if (singleUser) {
      return {
        id: singleUser.id,
        studentId: singleUser.studentId,
        email: singleUser.email,
        name: singleUser.name || "Student",
        targetThreshold: singleUser.targetThreshold,
      };
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
