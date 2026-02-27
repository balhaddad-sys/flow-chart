import { NextRequest, NextResponse } from "next/server";
import { verifyFirebaseToken } from "@/lib/server/firebase-token";

/**
 * Server-side proxy for Firestore reads.
 *
 * Flutter's cloud_firestore SDK uses gRPC (firestore.googleapis.com:443),
 * which is blocked by some ISPs (e.g. Kuwait). This route uses the Firestore
 * REST API from the Vercel edge and forwards the result as flat JSON that the
 * Flutter models can consume directly.
 *
 * Security: The caller's Firebase ID token is verified server-side.
 * Firestore calls are made with the same ID token — Firestore security rules
 * continue to apply. Users can only access their own data (users/{uid}/...).
 *
 * POST body:
 *   { col: "courses" | "tasks" | "stats" | "sections" | "files" | "user",
 *     courseId?: string,
 *     fileId?: string,
 *     today?: boolean }
 *
 * Returns: { docs: Array<FlatDocument> }
 */

const PROJECT_ID =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "medq-a6cc6";

const FS_ROOT = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

type SupportedCol =
  | "courses"
  | "tasks"
  | "stats"
  | "sections"
  | "files"
  | "user";

// ── Firestore value transformer ─────────────────────────────────────────────

type FsValue = Record<string, unknown>;

function fsValueToJs(value: FsValue): unknown {
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value)
    return parseInt(value.integerValue as string, 10);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("booleanValue" in value) return value.booleanValue;
  if ("nullValue" in value) return null;
  // ISO string — Flutter's TimestampConverter accepts this form
  if ("timestampValue" in value) return value.timestampValue;
  if ("arrayValue" in value) {
    const arr =
      (value.arrayValue as { values?: FsValue[] }).values ?? [];
    return arr.map(fsValueToJs);
  }
  if ("mapValue" in value) {
    const fields =
      (value.mapValue as { fields?: Record<string, FsValue> }).fields ?? {};
    return Object.fromEntries(
      Object.entries(fields).map(([k, v]) => [k, fsValueToJs(v)])
    );
  }
  return null;
}

interface FsDocument {
  name: string;
  fields?: Record<string, FsValue>;
}

function flattenDoc(doc: FsDocument): Record<string, unknown> {
  // Extract document ID from the full resource name
  const id = doc.name.split("/").pop() ?? "";
  const result: Record<string, unknown> = { id };
  for (const [key, val] of Object.entries(doc.fields ?? {})) {
    result[key] = fsValueToJs(val);
  }
  return result;
}

// ── Structured query builders ───────────────────────────────────────────────

type FieldFilter = {
  fieldFilter: {
    field: { fieldPath: string };
    op: string;
    value: FsValue;
  };
};

function eqFilter(field: string, value: string): FieldFilter {
  return {
    fieldFilter: {
      field: { fieldPath: field },
      op: "EQUAL",
      value: { stringValue: value },
    },
  };
}

function tsFilter(
  field: string,
  op: "GREATER_THAN_OR_EQUAL" | "LESS_THAN",
  iso: string
): FieldFilter {
  return {
    fieldFilter: {
      field: { fieldPath: field },
      op,
      value: { timestampValue: iso },
    },
  };
}

function composeWhere(
  filters: FieldFilter[]
): Record<string, unknown> | undefined {
  if (filters.length === 0) return undefined;
  if (filters.length === 1) return filters[0];
  return { compositeFilter: { op: "AND", filters } };
}

// ── Route handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await verifyFirebaseToken(req.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const col =
    typeof body.col === "string" ? (body.col as SupportedCol) : null;
  if (!col) {
    return NextResponse.json({ error: "col is required" }, { status: 400 });
  }

  // Forward the verified ID token to Firestore REST (user-level auth)
  const idToken = (req.headers.get("authorization") ?? "").slice(7);
  const authHeader = { Authorization: `Bearer ${idToken}` };
  const uid = user.uid;
  const userBase = `${FS_ROOT}/users/${uid}`;

  try {
    // ── Single document: user profile ───────────────────────────────────────
    if (col === "user") {
      const res = await fetch(`${userBase}`, { headers: authHeader });
      if (!res.ok)
        return NextResponse.json(
          { error: `Firestore ${res.status}` },
          { status: res.status }
        );
      const doc = (await res.json()) as FsDocument;
      // user doc uses uid as key, not doc.id
      const flat = flattenDoc(doc);
      flat.uid = uid;
      return NextResponse.json({ docs: [flat] });
    }

    // ── Single document: stats/{courseId} ───────────────────────────────────
    if (col === "stats") {
      const courseId =
        typeof body.courseId === "string" ? body.courseId : null;
      if (!courseId)
        return NextResponse.json(
          { error: "courseId required for stats" },
          { status: 400 }
        );
      const res = await fetch(`${userBase}/stats/${courseId}`, {
        headers: authHeader,
      });
      if (res.status === 404) return NextResponse.json({ docs: [] });
      if (!res.ok)
        return NextResponse.json(
          { error: `Firestore ${res.status}` },
          { status: res.status }
        );
      const doc = (await res.json()) as FsDocument;
      return NextResponse.json({ docs: [flattenDoc(doc)] });
    }

    // ── Collections via runQuery ─────────────────────────────────────────────
    const filters: FieldFilter[] = [];
    let orderBy: Array<{ field: { fieldPath: string }; direction: string }> =
      [];
    let colId: string;

    if (col === "courses") {
      colId = "courses";
      orderBy = [{ field: { fieldPath: "createdAt" }, direction: "ASCENDING" }];
    } else if (col === "files") {
      colId = "files";
      const courseId =
        typeof body.courseId === "string" ? body.courseId : null;
      if (courseId) filters.push(eqFilter("courseId", courseId));
    } else if (col === "sections") {
      colId = "sections";
      const fileId = typeof body.fileId === "string" ? body.fileId : null;
      const courseId =
        typeof body.courseId === "string" ? body.courseId : null;
      if (fileId) filters.push(eqFilter("fileId", fileId));
      if (courseId) filters.push(eqFilter("courseId", courseId));
      orderBy = [
        { field: { fieldPath: "orderIndex" }, direction: "ASCENDING" },
      ];
    } else if (col === "tasks") {
      colId = "tasks";
      const courseId =
        typeof body.courseId === "string" ? body.courseId : null;
      const today = body.today === true || body.today === "true";
      if (courseId) filters.push(eqFilter("courseId", courseId));
      if (today) {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth();
        const d = now.getDate();
        const start = new Date(y, m, d).toISOString();
        const end = new Date(y, m, d + 1).toISOString();
        filters.push(tsFilter("dueDate", "GREATER_THAN_OR_EQUAL", start));
        filters.push(tsFilter("dueDate", "LESS_THAN", end));
      }
      orderBy = [{ field: { fieldPath: "dueDate" }, direction: "ASCENDING" }];
    } else {
      return NextResponse.json(
        { error: "Unknown collection" },
        { status: 400 }
      );
    }

    const structuredQuery: Record<string, unknown> = {
      from: [{ collectionId: colId! }],
    };

    const whereClause = composeWhere(filters);
    if (whereClause) structuredQuery.where = whereClause;
    if (orderBy.length > 0) structuredQuery.orderBy = orderBy;
    structuredQuery.limit = 200;

    const res = await fetch(`${userBase}:runQuery`, {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ structuredQuery }),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Firestore runQuery failed (${res.status})` },
        { status: res.status }
      );
    }

    const rows = (await res.json()) as Array<{ document?: FsDocument }>;
    const docs = rows
      .filter((r): r is { document: FsDocument } => r.document != null)
      .map((r) => flattenDoc(r.document));

    return NextResponse.json({ docs });
  } catch (err) {
    console.error("[/api/m/fs]", err);
    return NextResponse.json(
      { error: "Firestore proxy request failed" },
      { status: 502 }
    );
  }
}
