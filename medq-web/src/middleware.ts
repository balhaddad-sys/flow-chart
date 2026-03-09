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

  // Generate a per-request nonce for CSP
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  // Forward the nonce to Server Components via a request header
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // Skip static assets and API routes
  if (SKIP_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return withSecurityHeaders(response, nonce);
  }

  // Allow public pages
  if (PUBLIC_PATHS.has(pathname)) {
    return withSecurityHeaders(response, nonce);
  }

  // Auth checks are enforced by client-side AuthGuard and backend Firestore rules.
  // This middleware adds security headers and handles basic routing
  // without introducing cookie-based false negatives.
  return withSecurityHeaders(response, nonce);
}

function withSecurityHeaders(response: NextResponse, nonce: string) {
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
    [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://firebasestorage.googleapis.com https://*.googleusercontent.com",
      "font-src 'self'",
      "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://*.cloudfunctions.net",
      "frame-src 'self' https://*.firebaseapp.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
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
