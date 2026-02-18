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
  const response = NextResponse.next();

  // Skip static assets and API routes
  if (SKIP_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return withSecurityHeaders(response);
  }

  // Allow public pages
  if (PUBLIC_PATHS.has(pathname)) {
    return withSecurityHeaders(response);
  }

  // Auth checks are enforced by client-side AuthGuard and backend Firestore rules.
  // This middleware adds security headers and handles basic routing
  // without introducing cookie-based false negatives.
  return withSecurityHeaders(response);
}

function withSecurityHeaders(response: NextResponse) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
  );
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  response.headers.set(
    "Content-Security-Policy",
    "frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
  );
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );
  return response;
}

export const config = {
  matcher: [
    // Match all paths except static files
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
