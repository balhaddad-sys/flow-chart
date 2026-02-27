import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side proxy for Firebase Auth REST API.
 *
 * Used by Flutter clients in regions where *.googleapis.com is DNS/IP-blocked
 * (e.g. some Kuwait ISPs). Since Vercel runs in US data centres it can reach
 * Firebase Auth on behalf of blocked clients.
 *
 * Supported actions (POST body):
 *   { action: "signIn",  email, password }
 *   { action: "signUp",  email, password, displayName? }
 *   { action: "refresh", refreshToken }
 *
 * All credentials are forwarded server-side; this route never stores them.
 * Rate-limiting relies on Firebase's own per-IP/per-project quotas.
 */

const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "";

const IDENTITY_TOOLKIT_BASE =
  "https://identitytoolkit.googleapis.com/v1/accounts";
const SECURE_TOKEN_URL = "https://securetoken.googleapis.com/v1/token";

type AuthAction = "signIn" | "signUp" | "refresh";
const ALLOWED_ACTIONS = new Set<string>(["signIn", "signUp", "refresh"]);

// ── Helpers ────────────────────────────────────────────────────────────────

function extractFirebaseError(body: Record<string, unknown>): string {
  const err = body.error;
  if (err && typeof err === "object") {
    const msg = (err as { message?: string }).message;
    if (msg) return msg;
  }
  return "Firebase request failed";
}

// ── Route handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!FIREBASE_API_KEY) {
    return NextResponse.json(
      { error: "Auth proxy not configured" },
      { status: 503 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : null;
  if (!action || !ALLOWED_ACTIONS.has(action)) {
    return NextResponse.json(
      { error: "action must be one of: signIn, signUp, refresh" },
      { status: 400 }
    );
  }

  try {
    // ── Sign in ─────────────────────────────────────────────────────────────
    if (action === "signIn") {
      const email = typeof body.email === "string" ? body.email.trim() : "";
      const password = typeof body.password === "string" ? body.password : "";
      if (!email || !password) {
        return NextResponse.json(
          { error: "email and password are required" },
          { status: 400 }
        );
      }

      const upstream = await fetch(
        `${IDENTITY_TOOLKIT_BASE}:signInWithPassword?key=${FIREBASE_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, returnSecureToken: true }),
        }
      );

      const data = (await upstream.json()) as Record<string, unknown>;
      if (!upstream.ok) {
        return NextResponse.json(
          { error: extractFirebaseError(data) },
          { status: upstream.status }
        );
      }

      return NextResponse.json({
        idToken: data.idToken,
        refreshToken: data.refreshToken,
        localId: data.localId,
        email: data.email,
        displayName: data.displayName ?? "",
        expiresIn: data.expiresIn ?? "3600",
      });
    }

    // ── Sign up ─────────────────────────────────────────────────────────────
    if (action === "signUp") {
      const email = typeof body.email === "string" ? body.email.trim() : "";
      const password = typeof body.password === "string" ? body.password : "";
      const displayName =
        typeof body.displayName === "string" ? body.displayName.trim() : "";
      if (!email || !password) {
        return NextResponse.json(
          { error: "email and password are required" },
          { status: 400 }
        );
      }

      const upstream = await fetch(
        `${IDENTITY_TOOLKIT_BASE}:signUp?key=${FIREBASE_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            displayName,
            returnSecureToken: true,
          }),
        }
      );

      const data = (await upstream.json()) as Record<string, unknown>;
      if (!upstream.ok) {
        return NextResponse.json(
          { error: extractFirebaseError(data) },
          { status: upstream.status }
        );
      }

      return NextResponse.json({
        idToken: data.idToken,
        refreshToken: data.refreshToken,
        localId: data.localId,
        email: data.email,
        displayName: data.displayName ?? displayName,
        expiresIn: data.expiresIn ?? "3600",
      });
    }

    // ── Token refresh ────────────────────────────────────────────────────────
    if (action === "refresh") {
      const refreshToken =
        typeof body.refreshToken === "string" ? body.refreshToken : "";
      if (!refreshToken) {
        return NextResponse.json(
          { error: "refreshToken is required" },
          { status: 400 }
        );
      }

      const upstream = await fetch(
        `${SECURE_TOKEN_URL}?key=${FIREBASE_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(
            refreshToken
          )}`,
        }
      );

      const data = (await upstream.json()) as Record<string, unknown>;
      if (!upstream.ok) {
        return NextResponse.json(
          { error: extractFirebaseError(data) },
          { status: upstream.status }
        );
      }

      return NextResponse.json({
        idToken: data.id_token,
        refreshToken: data.refresh_token,
        localId: data.user_id,
        expiresIn: data.expires_in ?? "3600",
      });
    }
  } catch (err) {
    console.error("[/api/m/auth]", err);
    return NextResponse.json(
      { error: "Auth proxy request failed" },
      { status: 502 }
    );
  }

  return NextResponse.json({ error: "Unhandled action" }, { status: 400 });
}
