# Consumer Readiness Audit Report

**Date:** 2026-02-20
**Application:** MedQ — AI-powered medical study platform
**Platforms:** Web (Next.js 15), Mobile (Flutter), Backend (Firebase Cloud Functions)
**Auditor:** Automated deep-code audit (6 parallel analysis passes)

---

## Executive Summary

**Overall Verdict: NOT YET consumer-ready — close, but with blockers.**

MedQ demonstrates strong engineering fundamentals: excellent TypeScript discipline, well-designed state management, robust Firebase security rules, comprehensive rate limiting, and solid error handling. However, the audit uncovered **3 blockers** and **14 high-priority issues** that must be addressed before a consumer launch.

| Dimension | Score | Notes |
|-----------|-------|-------|
| Code Quality & Architecture | **8.5 / 10** | Excellent TypeScript, clean patterns, one oversized component |
| Security | **7.5 / 10** | Strong auth & rules; npm vulns + leaked user data in repo |
| Accessibility (WCAG 2.1) | **5.5 / 10** | Good intent but multiple Level A violations |
| Performance | **7.0 / 10** | Solid fundamentals; missing virtualization for large lists |
| Testing | **5.0 / 10** | Backend well-tested; web tests not in CI, no E2E tests |
| UX / Edge Cases | **7.0 / 10** | Good empty/loading states; gaps in undo, confirmations |
| CI/CD & DevOps | **6.5 / 10** | Functional pipeline; web tests and functions lint missing from CI |

---

## BLOCKER Issues (Must fix before launch)

### B1. User credentials committed to repository
- **File:** `/temp-users.json`
- **Details:** Contains real user emails (`b.alhaddad13@gmail.com`, `bader.alhaddad.17@um.edu.mt`), display names, photo URLs, and Firebase UIDs.
- **Risk:** GDPR / data protection violation. Anyone with repo access can see real user PII.
- **Fix:** Remove from git history (`git filter-repo`), verify `.gitignore` excludes it.

### B2. Known HIGH-severity npm vulnerabilities
- **`fast-xml-parser`** (HIGH) — DoS via entity expansion in DOCTYPE. Transitive dep of `pdf-parse` and `mammoth`.
- **`minimatch`** (HIGH) — ReDoS via repeated wildcards.
- **`hono`** (MODERATE) — Timing comparison vulnerability in auth middleware.
- **Fix:** Run `npm audit fix` in both `/functions` and `/medq-web`. Pin or replace `pdf-parse` if upstream patch unavailable.

### B3. Web tests are never executed in CI
- **File:** `.github/workflows/firebase-deploy.yml`
- **Details:** The pipeline runs `npx next lint` and `npx next build` but **never runs `npm test`** for `medq-web`. The 12 web test files (2,139 lines) are effectively dead weight — regressions in stores, hooks, middleware, and error boundaries will not be caught before deployment.
- **Fix:** Add `cd medq-web && npm test` to the `test` job in `firebase-deploy.yml`.

---

## HIGH Priority Issues

### Security

**H1. Expand Content Security Policy**
- **File:** `medq-web/src/middleware.ts:46-65`
- CSP currently only sets `frame-ancestors`, `base-uri`, `form-action`. Missing `script-src`, `style-src`, `img-src`, `connect-src` directives. Without these, injected scripts from a compromised CDN or XSS vector can execute freely.

**H2. Functions linting not in CI**
- **File:** `.github/workflows/firebase-deploy.yml`
- ESLint is configured for `/functions` but never runs in the pipeline. `eqeqeq: error` and `no-var: error` rules exist but are unenforced.

### Accessibility (WCAG Level A violations)

**H3. No `prefers-reduced-motion` support**
- **Files:** `globals.css`, `animate-in.tsx`, `sidebar-v2.tsx`, `bottom-tab-bar.tsx`, `pipeline-progress.tsx`, `loading-state.tsx`
- The app uses extensive animations (slide-in, glow-pulse, stagger, sliding indicators) but never checks `prefers-reduced-motion`. This violates WCAG 2.1 SC 2.3.3 and can cause discomfort for vestibular-disorder users.

**H4. Quiz answer buttons lack accessible labels**
- **File:** `question-card.tsx:226-260`
- Screen reader users cannot distinguish which answer they are selecting. Each `<button>` needs an `aria-label` like `"Option A: {text}"`.

**H5. Custom modals lack focus traps**
- **File:** `flag-question-dialog.tsx:59`
- The flag-question modal is not built on Radix Dialog, so keyboard focus can escape the modal. Use the existing `<Dialog>` primitive or add manual focus trapping.

**H6. No keyboard alternative for drag-and-drop file upload**
- **File:** `file-upload-zone.tsx:121-146`
- The drop zone is the only obvious upload path. The hidden `<input type="file">` should be keyboard-focusable with a visible "Browse files" button.

**H7. Checkbox semantics broken**
- **Files:** `today-checklist.tsx:150`, `task-row.tsx:55`
- Checkboxes are `<button role="checkbox">` / `<div role="checkbox">` without `aria-label`. Native `<input type="checkbox">` or at minimum `aria-checked` + descriptive labels are needed.

### Performance

**H8. ExploreResults renders all questions without virtualization**
- **File:** `explore-results.tsx:119-242`
- With 50+ questions, each rendering nested citation lists and explanation text, this creates 5,000+ DOM nodes in a single pass. Implement `react-window` or `@tanstack/virtual`.

**H9. StreakGraph computations not memoized**
- **File:** `streak-graph.tsx:28-92`
- `computeStreak()` runs an O(365) loop and the 84-day grid is rebuilt on every render. Both should be wrapped in `useMemo`.

### Testing

**H10. No end-to-end tests exist**
- No Playwright, Cypress, or Selenium configuration found. Critical user flows (sign-up, quiz completion, file upload, AI chat) have zero browser-level test coverage. Backend `user-flows.test.js` tests module integration but not actual UI.

**H11. No pre-commit hooks**
- No Husky, lint-staged, or equivalent. Developers can commit code that fails linting, has type errors, or breaks tests. This is a quality gate gap.

### UX

**H12. No undo for quiz answers**
- **File:** `question-card.tsx`
- Once an answer is submitted, it is final. A brief confirmation window or undo toast would significantly improve the quiz experience.

**H13. Silent error catches in multiple locations**
- **Files:** `streak-graph.tsx:67`, `explore-store.ts:334,348`
- Errors are caught and silently swallowed. At minimum, add `console.warn` for debugging; ideally, show a non-blocking UI notification.

**H14. Exam countdown edge case**
- **File:** `exam-countdown.tsx:23`
- `isPassed` triggers when `daysLeft === 0` but does not handle negative values (past-due exams).

---

## MEDIUM Priority Issues

### Code Quality
| # | Issue | File | Line(s) |
|---|-------|------|---------|
| M1 | `question-card.tsx` is 510 lines — split into QuestionDisplay, AnswerOptions, ExplanationPanel, TutorPanel | `question-card.tsx` | all |
| M2 | ESLint `exhaustive-deps` disabled without justification | `question-card.tsx` | 90 |
| M3 | Global `msgCounter` variable — use `useRef` instead | `explore-ask-ai-widget.tsx` | 39 |
| M4 | Hardcoded UI strings ("AI Study Cockpit", "Today's Directive", quick prompts) — extract to constants/i18n | multiple | — |
| M5 | Stats cards have loading state but no error state UI | `stats-cards.tsx` | — |

### Accessibility
| # | Issue | File | Line(s) |
|---|-------|------|---------|
| M6 | Dropdown trigger missing `aria-expanded` / `aria-haspopup` | `sidebar-v2.tsx` | 99 |
| M7 | Color contrast needs WCAG AA audit on difficulty labels (green/yellow/red on light bg) | `question-card.tsx` | 145-150 |
| M8 | Missing `<h1>` on several app pages | multiple | — |
| M9 | Form validation errors not linked via `aria-describedby` | `signup/page.tsx` | — |
| M10 | Flag dialog textarea lacks associated label | `flag-question-dialog.tsx` | 115-144 |

### Performance
| # | Issue | File | Line(s) |
|---|-------|------|---------|
| M11 | QuestionCard uses 4 separate `useState` — consolidate to reduce re-renders | `question-card.tsx` | 40-44 |
| M12 | `useDebouncedCallback` hook exists but is unused in any component | `useDebounce.ts` | — |
| M13 | Explore teaching custom bar chart could be lazy-loaded | `explore-teaching.tsx` | 30-86 |

### CI/CD
| # | Issue | File |
|---|-------|------|
| M14 | No test coverage reporting — no visibility into regressions | `jest.config.ts` |
| M15 | Flutter CI has no dependency caching configured | `flutter-ci.yml` |

---

## LOW Priority Issues

| # | Issue | Category |
|---|-------|----------|
| L1 | Some font sizes use 0.6rem / 0.65rem — may not meet WCAG AA minimum | a11y |
| L2 | No scroll position restoration on back-navigation | UX |
| L3 | Chat clearing (explore/study widgets) has no confirmation dialog | UX |
| L4 | No "scroll to top" on long quiz pages | UX |
| L5 | No `next/image` component for avatar images | perf |
| L6 | Sidebar nav descriptions defined in code but never shown to users | UX |
| L7 | Charts and visualizations lack `aria-label` descriptions | a11y |
| L8 | Mobile padding may conflict with virtual keyboards | UX |

---

## What's Working Well

The audit also found significant strengths that indicate mature engineering:

1. **TypeScript discipline** — Near-zero `any` usage (~1 justified instance), strict mode enabled, zero `@ts-ignore`.
2. **State management** — Zustand stores are clean with proper Map serialization, phase-based state machines, and persistence.
3. **Firebase security rules** — Comprehensive ownership checks, Cloud Functions-only writes for sensitive collections, invite code validation for groups.
4. **Rate limiting** — Firestore-backed sliding window with in-memory cache fallback, per-operation limits.
5. **Error handling** — Custom error classes with `isTransient` flags, exponential backoff retry logic, human-readable error mappings.
6. **Auth patterns** — `useSyncExternalStore` for auth state, proper RS256 JWT validation server-side, token caching with TTL.
7. **Memory management** — All `useEffect` cleanups properly implemented: Firebase unsubscribes, IntersectionObserver disconnects, timer clears, AbortController aborts.
8. **CSS architecture** — OKLCH with HSL fallbacks, proper dark mode tokens, clean layer structure.
9. **Input sanitization** — Server-side HTML/script stripping applied to all AI-generated content before storage.
10. **Deployment safety** — Canary deploy pattern, batched Cloud Function deploys with retries, predeploy test gates.

---

## Recommended Fix Priority

### Before Launch (Week 1)
1. Remove `temp-users.json` from git history (B1)
2. Run `npm audit fix` in both packages (B2)
3. Add web tests to CI pipeline (B3)
4. Add `prefers-reduced-motion` support (H3)
5. Fix quiz answer button a11y labels (H4)
6. Add focus trap to flag dialog (H5)
7. Add keyboard-accessible file upload button (H6)

### Before Public Marketing (Week 2)
8. Implement list virtualization for ExploreResults (H8)
9. Memoize StreakGraph computations (H9)
10. Add Husky pre-commit hooks with lint + type check (H11)
11. Fix checkbox semantics (H7)
12. Expand CSP directives (H1)
13. Add functions lint to CI (H2)

### Before Scale (Week 3+)
14. Set up Playwright E2E tests for critical flows (H10)
15. Split QuestionCard into sub-components (M1)
16. Extract hardcoded strings to constants (M4)
17. Add test coverage reporting (M14)
18. Address medium-priority a11y issues (M6-M10)

---

## Metrics Summary

| Metric | Value |
|--------|-------|
| Total source files analyzed | 226 |
| Total lines of code (web) | ~21,679 |
| Cloud Functions exported | 32 |
| Test files (backend) | 19 (2,523 lines) |
| Test files (web) | 12 (2,139 lines) |
| Test files (Flutter) | 4 |
| Blocker issues | 3 |
| High-priority issues | 14 |
| Medium-priority issues | 15 |
| Low-priority issues | 8 |
| `any` types | 1 (justified) |
| `console.log` in production | 0 |
| Memory leaks found | 0 |
| XSS vulnerabilities | 0 |
| SQL injection risk | N/A (NoSQL) |
