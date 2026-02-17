const FIREBASE_PROJECT_ID =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "medq-a6cc6";

const CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
const CERTS_FALLBACK_TTL_MS = 3_600_000;
const TOKEN_CACHE_MAX_ENTRIES = 512;

interface FirebaseTokenHeader {
  alg?: string;
  kid?: string;
}

interface FirebaseTokenPayload {
  iss?: string;
  aud?: string;
  sub?: string;
  exp?: number;
}

interface CertsCacheEntry {
  keys: Record<string, string>;
  expiresAt: number;
}

interface TokenCacheEntry {
  uid: string;
  expMs: number;
}

let certsCache: CertsCacheEntry | null = null;
const verifiedTokenCache = new Map<string, TokenCacheEntry>();

async function fetchPublicKeys(): Promise<Record<string, string>> {
  if (certsCache && Date.now() < certsCache.expiresAt) {
    return certsCache.keys;
  }

  const res = await fetch(CERTS_URL);
  if (!res.ok) {
    throw new Error("Failed to fetch Firebase public keys");
  }

  const keys = (await res.json()) as Record<string, string>;
  const cacheControl = res.headers.get("cache-control") ?? "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const ttlMs = maxAgeMatch
    ? parseInt(maxAgeMatch[1], 10) * 1000
    : CERTS_FALLBACK_TTL_MS;

  certsCache = {
    keys,
    expiresAt: Date.now() + ttlMs,
  };

  return keys;
}

function trimTokenCache() {
  if (verifiedTokenCache.size <= TOKEN_CACHE_MAX_ENTRIES) return;

  const now = Date.now();
  for (const [token, entry] of verifiedTokenCache.entries()) {
    if (entry.expMs <= now) {
      verifiedTokenCache.delete(token);
    }
  }

  while (verifiedTokenCache.size > TOKEN_CACHE_MAX_ENTRIES) {
    const oldestKey = verifiedTokenCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    verifiedTokenCache.delete(oldestKey);
  }
}

function base64urlDecodeToBytes(input: string): Uint8Array {
  const bytes = Buffer.from(input, "base64url");
  return new Uint8Array(bytes);
}

function base64urlDecodeToJson<T>(input: string): T {
  const text = Buffer.from(input, "base64url").toString("utf-8");
  return JSON.parse(text) as T;
}

function pemToSpki(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN CERTIFICATE-----/, "")
    .replace(/-----END CERTIFICATE-----/, "")
    .replace(/\s/g, "");

  const der = Buffer.from(b64, "base64");
  return der.buffer.slice(
    der.byteOffset,
    der.byteOffset + der.byteLength
  ) as ArrayBuffer;
}

export async function verifyFirebaseToken(
  authHeader: string | null
): Promise<{ uid: string } | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const nowMs = Date.now();
  const cached = verifiedTokenCache.get(token);
  if (cached && cached.expMs > nowMs + 5_000) {
    return { uid: cached.uid };
  }
  if (cached && cached.expMs <= nowMs) {
    verifiedTokenCache.delete(token);
  }

  try {
    const [rawHeader, rawPayload, rawSig] = token.split(".");
    if (!rawHeader || !rawPayload || !rawSig) {
      return null;
    }

    const header = base64urlDecodeToJson<FirebaseTokenHeader>(rawHeader);
    const payload = base64urlDecodeToJson<FirebaseTokenPayload>(rawPayload);
    const nowSec = Math.floor(nowMs / 1000);

    if (
      header.alg !== "RS256" ||
      !header.kid ||
      payload.iss !==
        `https://securetoken.google.com/${FIREBASE_PROJECT_ID}` ||
      payload.aud !== FIREBASE_PROJECT_ID ||
      !payload.sub ||
      typeof payload.sub !== "string" ||
      typeof payload.exp !== "number" ||
      payload.exp <= nowSec
    ) {
      return null;
    }

    const certs = await fetchPublicKeys();
    const certPem = certs[header.kid];
    if (!certPem) return null;

    const key = await crypto.subtle.importKey(
      "spki",
      pemToSpki(certPem),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const sigBytes = base64urlDecodeToBytes(rawSig);
    const signedPayload = new TextEncoder().encode(`${rawHeader}.${rawPayload}`);
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      sigBytes.buffer.slice(
        sigBytes.byteOffset,
        sigBytes.byteOffset + sigBytes.byteLength
      ) as ArrayBuffer,
      signedPayload
    );

    if (!valid) return null;

    const expMs = payload.exp * 1000;
    verifiedTokenCache.set(token, { uid: payload.sub, expMs });
    trimTokenCache();

    return { uid: payload.sub };
  } catch {
    return null;
  }
}
