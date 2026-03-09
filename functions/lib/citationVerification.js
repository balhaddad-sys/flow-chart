/**
 * @module lib/citationVerification
 * @description Server-side evidence reference verification helpers.
 *
 * Verification strategy:
 * - PMID: validated against NCBI E-utilities (PubMed).
 * - DOI: validated against Crossref Works API.
 * - Guideline IDs: validated via strict identifier patterns.
 *
 * Notes:
 * - Network checks are intentionally capped per question to control latency.
 * - Results are cached in-memory for the lifetime of the function instance.
 */

const { applyEvidenceQuality, extractPmid } = require("./serialize");

const DOI_RE = /\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/i;
const GUIDELINE_ID_RE =
  /\b(?:NICE\s*(?:NG|CG|QS)\s*\d+|SIGN\s*\d+|ESC\s*20\d{2}|AHA\/ACC\s*20\d{2}|USPSTF\s*20\d{2}|RCOG\s*(?:GTG|GREEN-?TOP)\s*(?:NO\.?)?\s*\d+[A-Z]?)\b/i;

const VERIFY_TIMEOUT_MS = 4500;
const VERIFY_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const verifyCache = new Map();

function nowMs() {
  return Date.now();
}

function cacheKey(type, value) {
  return `${type}:${String(value || "").trim().toLowerCase()}`;
}

function getCached(key) {
  const hit = verifyCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= nowMs()) {
    verifyCache.delete(key);
    return null;
  }
  return hit.value;
}

function setCached(key, value) {
  verifyCache.set(key, {
    value: Boolean(value),
    expiresAt: nowMs() + VERIFY_CACHE_TTL_MS,
  });
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.json().catch(() => null);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function extractDoi(text) {
  const match = String(text || "").match(DOI_RE);
  return match ? match[0] : null;
}

function extractGuidelineId(text) {
  const match = String(text || "").toUpperCase().match(GUIDELINE_ID_RE);
  if (!match) return null;
  return match[0].replace(/\s+/g, " ").trim();
}

async function verifyPmid(pmid) {
  if (!pmid) return false;
  const key = cacheKey("pmid", pmid);
  const cached = getCached(key);
  if (cached != null) return cached;

  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${encodeURIComponent(
    String(pmid)
  )}&retmode=json`;
  const data = await fetchJson(url);
  const found = Boolean(data?.result && data.result[String(pmid)]?.uid === String(pmid));
  setCached(key, found);
  return found;
}

async function verifyDoi(doi) {
  if (!doi) return false;
  const normalized = String(doi).trim().toLowerCase();
  const key = cacheKey("doi", normalized);
  const cached = getCached(key);
  if (cached != null) return cached;

  const url = `https://api.crossref.org/works/${encodeURIComponent(normalized)}`;
  const data = await fetchJson(url);
  const found = Boolean(data?.status === "ok" && data?.message?.DOI);
  setCached(key, found);
  return found;
}

function verifyGuidelineId(guidelineId) {
  if (!guidelineId) return false;
  const normalized = String(guidelineId).trim().toUpperCase();
  return GUIDELINE_ID_RE.test(normalized);
}

function isFallbackCitation(citation) {
  return /^(PubMed|UpToDate|Medscape):/i.test(String(citation?.title || ""));
}

function hasRemoteEvidenceId(citation) {
  const title = String(citation?.title || "");
  return Boolean(extractPmid(title) || extractDoi(title));
}

async function verifyCitation(citation) {
  const base = {
    ...citation,
    verified: false,
  };

  const title = String(citation?.title || "").trim();
  if (!title) return base;

  const pmid = extractPmid(title);
  if (pmid) {
    const ok = await verifyPmid(pmid);
    if (ok) {
      return {
        ...base,
        verified: true,
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      };
    }
  }

  const doi = extractDoi(title);
  if (doi) {
    const ok = await verifyDoi(doi);
    if (ok) {
      return {
        ...base,
        verified: true,
        url: `https://doi.org/${doi}`,
      };
    }
  }

  const guidelineId = extractGuidelineId(title);
  if (verifyGuidelineId(guidelineId)) {
    return {
      ...base,
      verified: true,
    };
  }

  return base;
}

async function verifyCitations(citations, { maxRemoteChecks = 3 } = {}) {
  if (!Array.isArray(citations) || citations.length === 0) return [];

  const out = [];
  let remoteChecks = 0;

  for (const citation of citations) {
    if (!citation) continue;

    if (isFallbackCitation(citation)) {
      out.push({ ...citation, verified: false });
      continue;
    }

    if (hasRemoteEvidenceId(citation)) {
      if (remoteChecks >= maxRemoteChecks) {
        out.push({ ...citation, verified: false });
        continue;
      }
      remoteChecks++;
    }

    out.push(await verifyCitation(citation));
  }

  return out;
}

async function verifyQuestionEvidence(question, opts = {}) {
  if (!question || typeof question !== "object") return question;
  const citations = await verifyCitations(question.citations, opts);
  return applyEvidenceQuality({
    ...question,
    citations,
  });
}

async function verifyQuestionEvidenceBatch(questions, opts = {}) {
  if (!Array.isArray(questions) || questions.length === 0) return [];
  const verified = [];
  for (const question of questions) {
    verified.push(await verifyQuestionEvidence(question, opts));
  }
  return verified;
}

module.exports = {
  extractDoi,
  extractGuidelineId,
  verifyPmid,
  verifyDoi,
  verifyCitation,
  verifyCitations,
  verifyQuestionEvidence,
  verifyQuestionEvidenceBatch,
};

