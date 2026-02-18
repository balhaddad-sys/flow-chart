/**
 * @file middleware.test.ts
 * @description Tests for Next.js middleware — verifies all security headers
 * are set correctly and routing logic. Uses undici Request polyfill for jsdom.
 *
 * @jest-environment node
 */

import { NextRequest, NextResponse } from "next/server";
import { middleware } from "./middleware";

function makeRequest(pathname: string): NextRequest {
  return new NextRequest(new URL(`http://localhost:3000${pathname}`));
}

describe("middleware", () => {
  describe("security headers", () => {
    const expectedHeaders: Record<string, string> = {
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-XSS-Protection": "1; mode=block",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
      "Cross-Origin-Resource-Policy": "same-origin",
    };

    it.each(Object.entries(expectedHeaders))(
      "sets %s header on public routes",
      (header, value) => {
        const response = middleware(makeRequest("/"));
        expect(response.headers.get(header)).toBe(value);
      }
    );

    it.each(Object.entries(expectedHeaders))(
      "sets %s header on authenticated routes",
      (header, value) => {
        const response = middleware(makeRequest("/today"));
        expect(response.headers.get(header)).toBe(value);
      }
    );

    it("sets Permissions-Policy header", () => {
      const response = middleware(makeRequest("/"));
      const pp = response.headers.get("Permissions-Policy");
      expect(pp).toContain("camera=()");
      expect(pp).toContain("microphone=()");
      expect(pp).toContain("geolocation=()");
      expect(pp).toContain("payment=()");
      expect(pp).toContain("usb=()");
    });

    it("sets Content-Security-Policy with frame-ancestors none", () => {
      const response = middleware(makeRequest("/"));
      const csp = response.headers.get("Content-Security-Policy");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("form-action 'self'");
    });

    it("sets HSTS with preload", () => {
      const response = middleware(makeRequest("/"));
      const hsts = response.headers.get("Strict-Transport-Security");
      expect(hsts).toContain("max-age=31536000");
      expect(hsts).toContain("includeSubDomains");
      expect(hsts).toContain("preload");
    });
  });

  describe("public routes", () => {
    const publicPaths = ["/", "/login", "/signup", "/forgot-password", "/terms", "/privacy"];

    it.each(publicPaths)("returns response for public path %s", (path) => {
      const response = middleware(makeRequest(path));
      expect(response).toBeInstanceOf(NextResponse);
      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    });
  });

  describe("static asset skip paths", () => {
    const skipPaths = [
      "/_next/static/chunks/main.js",
      "/api/chat",
      "/icons/icon-192.png",
      "/manifest.json",
      "/favicon.ico",
    ];

    it.each(skipPaths)("adds security headers even for skip path %s", (path) => {
      const response = middleware(makeRequest(path));
      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    });
  });

  describe("app routes", () => {
    const appPaths = ["/today", "/ai", "/library", "/practice/quiz", "/study/abc/def"];

    it.each(appPaths)("adds security headers for app route %s", (path) => {
      const response = middleware(makeRequest(path));
      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(response.headers.get("Strict-Transport-Security")).toContain("max-age=31536000");
    });
  });
});
