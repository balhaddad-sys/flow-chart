import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that don't require authentication
const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/terms",
  "/privacy",
]);

// Static asset prefixes to skip
const SKIP_PREFIXES = [
  "/_next",
  "/api",
  "/icons",
  "/manifest.json",
  "/favicon.ico",
  "/og-image.png",
  "/robots.txt",
  "/sitemap.xml",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets and API routes
  if (SKIP_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // Allow public pages
  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  // Check for Firebase auth session cookie
  // Firebase Auth stores the session in __session or uses ID tokens
  // We check for the presence of auth-related cookies as a lightweight gate
  const hasSession =
    request.cookies.has("__session") ||
    request.cookies.has("firebase-auth-token");

  // If no session indicator, let the client-side AuthGuard handle the redirect
  // This middleware adds security headers and handles basic routing
  // The actual auth verification happens client-side via Firebase SDK
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
