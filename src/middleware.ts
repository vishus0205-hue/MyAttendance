import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE_NAME = "myattendance_session";

// Routes that require authentication
const PROTECTED_ROUTES = ["/dashboard", "/attendance", "/subjects", "/calendar", "/settings"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  const isProtectedRoute = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
  const isAuthRoute = pathname === "/login" || pathname === "/register";

  // If user has no session cookie and tries to access a protected route
  if (isProtectedRoute && !sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // If user is already logged in and tries to access login or register
  if (isAuthRoute && sessionCookie) {
    const dashboardUrl = new URL("/dashboard", request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/attendance/:path*",
    "/subjects/:path*",
    "/calendar/:path*",
    "/settings/:path*",
    "/login",
    "/register",
  ],
};
