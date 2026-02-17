# MedQ — Comprehensive Issue Analysis

> Generated: 2026-02-17 | All 186 backend tests and 95 frontend tests pass.

## CRITICAL Issues (Fix Immediately)

### 1. PII Exposed in Version Control
- **File**: `temp-users.json`
- **Severity**: CRITICAL
- Contains real user emails, Google OAuth IDs, profile photos, and display names.
- `.gitignore` lists `temp-users.json` but the file is already tracked in git history.
- **Risk**: Exposed PII if repo is/becomes public.
- **Fix**: Remove from git history with `git filter-branch` or BFG Repo-Cleaner.

### 2. In-Memory Rate Limiting on API Routes
- **File**: `medq-web/src/app/api/explore-chat/route.ts` (lines 118-136)
- **Severity**: CRITICAL
- Uses `Map<string, number[]>()` — lost on every restart/deployment, not shared across Vercel replicas.
- Map never evicts old entries (unbounded memory growth).
- **Risk**: Attacker can abuse expensive Gemini API calls; eventual OOM.
- **Fix**: Use Firestore-backed rate limiter or move behind Firebase callable.

### 3. No Request Body Size Validation
- **File**: `medq-web/src/app/api/summary/route.ts` (line 184)
- **Severity**: CRITICAL
- Accepts `sectionText` with no size limit — memory exhaustion or API timeout risk.
- **Fix**: Add `sectionText.length` check before processing.

---

## HIGH Severity Issues

### 4. Race Condition in File Processing
- **File**: `functions/processing/processFile.js` (lines 65-81)
- Non-atomic read-then-write idempotency guard. Two concurrent triggers can both proceed.
- **Fix**: Wrap status check + update in a Firestore transaction.

### 5. Idempotency Key Collision in Attempt Logging
- **File**: `functions/analytics/submitAttempt.js` (lines 54-69)
- Key uses `Math.floor(Date.now() / 1000)` — two attempts within 1 second silently deduped.
- **Impact**: Lost performance data, inaccurate weakness scores.
- **Fix**: Use UUID or millisecond-precision timestamp.

### 6. Scheduling: Review Tasks Collapse at End of Plan
- **File**: `functions/scheduling/scheduler.js` (line 337)
- `Math.min(studyDayIdx + dayOffset, days.length - 1)` clamps all late reviews to the final day.
- **Impact**: Last days overloaded; spaced repetition loses its spacing.
- **Fix**: Extend schedule window or distribute clamped reviews backwards.

### 7. Weakness Stats Throttling Drops Data
- **File**: `functions/analytics/computeWeakness.js` (lines 37-48)
- 30-second throttle silently skips stats recomputation if attempts arrive quickly.
- **Impact**: Weakness dashboard lags; quiz weighting uses stale data.
- **Fix**: Debounce/queue pattern instead of dropping events.

### 8. Missing Questions Task When Generation Fails
- **File**: `functions/scheduling/scheduler.js` (lines 178-181)
- Only creates QUESTIONS task if `questionsStatus === "COMPLETED"`. Failed sections get no quiz task.
- **Impact**: Gaps in study plan.
- **Fix**: Create task regardless, or add RETRY_QUESTIONS task type.

### 9. Silent Auth Failure for Missing Key ID
- **File**: `medq-web/src/app/api/summary/route.ts` (lines 79-92)
- JWT with unknown `kid` returns `null` silently — makes debugging auth failures difficult.
- **Fix**: Log warning when `kid` lookup fails.

---

## MEDIUM Severity Issues

### 10. Stuck Files on `maybeMarkFileReady` Failure
- **File**: `functions/processing/processSection.js` (lines 215-232)
- If marking file ready fails, file stays in ANALYZING state forever.
- **Fix**: Add alerting or scheduled cleanup.

### 11. Weakness Recency Penalty Caps at 14 Days
- **File**: `functions/questions/questionSelection.js` (lines 24-30)
- After 14 days, all neglected topics score identically (1.0).
- **Impact**: Random prioritization between 20-day and 365-day neglected topics.

### 12. `DIFFICULTY_DISTRIBUTION.medium` is `null`
- **File**: `functions/lib/constants.js` (lines 88-90)
- Consumers reading `medium` directly get `null` (potential NaN propagation).

### 13. No Persistent Zustand State
- Quiz/onboarding stores lost on page refresh.

### 14. No Error Tracking Service
- No Sentry/Rollbar — production bugs may go unnoticed.

---

## LOW Severity Issues

### 15. Deprecated Dependencies
- `eslint@8.57.1`, `glob@7.2.3`, `inflight@1.0.6`, `rimraf@3.0.2`
- 2 high-severity npm audit issues in medq-web; 1 low in functions.

### 16. Node Engine Mismatch
- `functions/package.json` requires Node 20; local env runs Node 22.

### 17. Misleading AI Tier Names
- `functions/ai/aiClient.js` — LIGHT and HEAVY both use `claude-haiku-4-5`.

### 18. Missing E2E Tests
- No Playwright/Cypress tests for critical user flows.

### 19. `MAX_BASE64_LENGTH` Comment Incorrect
- `functions/lib/constants.js:109` — 450,000 base64 chars = ~337.5 KB, not ~450 KB.

---

## Priority Fix Order

1. Purge `temp-users.json` from git history
2. Replace in-memory rate limiter on API routes with Firestore-backed solution
3. Add request body size validation on API routes
4. Fix race condition in `processFile.js` with transaction
5. Fix idempotency key collision in `submitAttempt.js`
6. Fix review task clamping in scheduler
7. Improve weakness stats throttling
8. Add error tracking (Sentry)
9. Add Zustand persistence for quiz state
10. Add E2E tests
