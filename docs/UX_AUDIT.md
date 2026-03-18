# MedQ — Comprehensive UX Audit & Enhancement Roadmap

**Date:** 2026-03-18
**Scope:** Full-stack audit covering frontend (Next.js 15), backend (Cloud Functions), AI integrations, and end-to-end user flows.

---

## Executive Summary

MedQ is a well-architected medical study platform with strong foundations: clean component structure, consistent design language, comprehensive error handling, and exam-aware AI prompts. However, several high-impact UX gaps create friction that reduces retention and perceived reliability. This audit identifies **47 issues** across 12 categories and proposes **30 prioritised enhancements** that would significantly elevate the user experience.

**Overall UX Score: 6.5/10** — Functional and feature-rich, but lacks the polish, feedback loops, and guidance that turn a good tool into an indispensable one.

---

## Table of Contents

1. [Critical Friction Points](#1-critical-friction-points)
2. [Onboarding & First-Run Experience](#2-onboarding--first-run-experience)
3. [Loading States & Progress Communication](#3-loading-states--progress-communication)
4. [Error Handling & Recovery](#4-error-handling--recovery)
5. [Navigation & Information Architecture](#5-navigation--information-architecture)
6. [Quiz & Assessment UX](#6-quiz--assessment-ux)
7. [Study Session UX](#7-study-session-ux)
8. [Library & File Management](#8-library--file-management)
9. [AI Chat UX](#9-ai-chat-ux)
10. [Planner & Scheduling UX](#10-planner--scheduling-ux)
11. [Mobile Responsiveness](#11-mobile-responsiveness)
12. [Accessibility](#12-accessibility)
13. [Visual Design & Feedback](#13-visual-design--feedback)
14. [Backend UX Impact](#14-backend-ux-impact)
15. [Enhancement Roadmap](#15-enhancement-roadmap)

---

## 1. Critical Friction Points

These are the highest-impact issues that cause user confusion, frustration, or abandonment.

### 1.1 Silent Background Processing
**Severity: HIGH** | **Impact: Retention**

After uploading files, AI analysis runs silently in the background. Users have no idea:
- When processing starts or finishes
- Which files are being analyzed
- Whether processing succeeded or failed
- When they can start quizzing

**Current behavior:** A small `FileProcessingNotifier` shows "AI is analysing X files" but provides no per-file progress, no ETA, and no completion notification.

**Enhancement:**
- Add a persistent processing drawer/panel showing per-file status with stages (Extracting → Analyzing → Generating Questions)
- Send a browser notification when processing completes
- Show estimated time based on file size/page count
- Add a "Processing complete — Start Quiz" CTA that appears when ready

### 1.2 No "What's Next" Guidance
**Severity: HIGH** | **Impact: Activation**

After key milestones (course creation, file upload, plan generation), users land on pages with no clear guidance on what to do next. The app assumes users understand the workflow.

**Enhancement:**
- Add a contextual "Next Steps" card on the home/today page that adapts to user state:
  - No files → "Upload your study materials to get started"
  - Files processing → "Your materials are being analyzed — we'll notify you when ready"
  - Files ready, no plan → "Generate your study plan"
  - Plan exists → "Today's tasks" with direct action buttons
- Add a progress checklist widget showing setup completion (Upload → Analyze → Schedule → Study → Quiz)

### 1.3 Plan Generation Failures Are Confusing
**Severity: HIGH** | **Impact: Trust**

When schedule generation fails due to insufficient study days, the error message ("Not enough study days") provides no context. Users don't understand:
- How much time they need
- What inputs caused the problem
- How to fix it

**Enhancement:**
- Show the math: "You have 5 days until your exam with 60 min/day = 5 hours total. Your materials need ~12 hours. Either extend your exam date or increase daily study time."
- Add inline suggestions with one-tap fixes ("Change to 120 min/day" or "Move exam to [date]")
- Show a feasibility indicator BEFORE generation starts

### 1.4 Stale "Generating" States
**Severity: MEDIUM** | **Impact: Trust**

If a Cloud Function crashes mid-generation (questions, schedule, blueprint), the UI shows "Generating..." indefinitely. The backend detects stale state after 3 minutes, but:
- Users don't know the 3-minute threshold
- No automatic recovery is visible
- The "Retry" button may not appear until page refresh

**Enhancement:**
- Add a client-side timeout (90 seconds) with a "This is taking longer than expected" message and a retry button
- Implement heartbeat polling: check generation status every 15 seconds, show "Still working..." with elapsed time
- Auto-surface the retry option after 2 minutes without completion

---

## 2. Onboarding & First-Run Experience

### Current State
The onboarding flow has only 2 steps:
1. Course creation (title, exam type, exam date, daily availability)
2. Redirect to home

### Issues

| Issue | Impact |
|-------|--------|
| No product tour or feature walkthrough | Users miss key features (AI chat, weakness analysis, explore mode) |
| Exam date and availability are optional but critically affect scheduling | Users skip them, then get poor plans |
| No sample data or demo mode | Users can't evaluate the product before uploading their own materials |
| "Welcome back" message on return is the same as first visit | No personalization |
| No explanation of what each exam type means for question generation | Users may pick the wrong exam type |

### Enhancements

1. **Guided onboarding tour** (5-7 steps) highlighting key features with tooltips:
   - "Upload your study materials here"
   - "AI will generate questions from your content"
   - "Your personalized study plan appears here"
   - "Track your weaknesses and get AI remediation"
   - "Chat with AI about your materials"

2. **Sample course with pre-loaded data** — Let users explore a demo course with sample files, questions, and a study plan before uploading their own materials.

3. **Exam type explainer** — Tooltip or expandable section explaining how exam type affects question style (e.g., "PLAB 1: UK NHS scenarios, NICE guidelines, BNF drug names").

4. **Smart defaults with explanation** — If users skip exam date/availability, show: "Without an exam date, we'll create a 30-day plan. You can update this anytime in Settings."

5. **Progressive profile completion** — Show a completion bar: "Your profile is 40% complete. Add your exam date for a better study plan."

---

## 3. Loading States & Progress Communication

### Strengths
- Three-tier loading system (PageLoadingState, SectionLoadingState, ListLoadingState)
- Skeleton loaders for perceived performance
- Contextual messages explaining delays

### Issues

| Issue | Current Behavior | Better Approach |
|-------|-----------------|-----------------|
| Long AI operations (1-3 min) | Spinner + "Generating..." | Progress stages + ETA + cancel option |
| File upload progress | Progress bar (good) | Add "X of Y MB uploaded" text |
| Auto-generation on Today page | Silent background trigger | "Preparing your daily plan..." with cancel |
| Quiz loading | Brief spinner | Skeleton quiz card with pulsing options |
| Chat message streaming | No streaming — waits for full response | Stream tokens as they arrive for perceived speed |

### Enhancements

1. **Staged progress indicators for AI operations:**
   ```
   Step 1/3: Analyzing your materials...     ✓ Complete
   Step 2/3: Generating questions...          ● In progress (est. 45s)
   Step 3/3: Calibrating difficulty...        ○ Waiting
   ```

2. **Chat response streaming** — Stream AI responses token-by-token instead of waiting for the full response. This alone can make the chat feel 5-10x faster.

3. **Cancellable operations** — Add cancel buttons on long-running operations (schedule generation, question generation). Even if the backend continues, the UI should allow users to navigate away.

4. **Time-remaining estimates** — Based on historical averages: "Question generation typically takes 30-60 seconds for this section size."

---

## 4. Error Handling & Recovery

### Strengths
- Centralized error registry with 11 error codes
- Safe error wrapping (never leaks stack traces)
- Humanized auth error messages
- Toast notifications for all actions

### Issues

| Issue | Example | Impact |
|-------|---------|--------|
| Generic error messages | "Failed to generate questions" | Users can't self-diagnose |
| No recovery suggestions | "AI processing failed" with no next step | Users feel stuck |
| Rate limit errors lack timing | "Too many requests. Please wait" | Users don't know how long to wait |
| Network errors not distinguished | Same message for offline vs. server error | Wrong mental model |
| No error history/log | Errors disappear after toast dismissal | Can't report issues |

### Enhancements

1. **Actionable error messages with recovery paths:**

   | Current | Enhanced |
   |---------|----------|
   | "Failed to generate questions" | "Question generation failed — the AI couldn't process this section. Try: (1) Retry now, (2) Re-upload the file, or (3) Contact support if this persists." |
   | "Too many requests" | "You've hit the rate limit. You can try again in ~45 seconds." |
   | "AI processing failed" | "The AI service is temporarily unavailable. Your request has been queued and will retry automatically." |

2. **Offline detection banner** — Show a persistent "You're offline — changes will sync when you reconnect" banner instead of generic errors.

3. **Error retry with backoff indicator** — Show a countdown: "Retrying in 8 seconds..." with a manual retry button.

4. **Error log accessible in Settings** — Let users view recent errors for debugging and support tickets.

---

## 5. Navigation & Information Architecture

### Strengths
- Clear hierarchy: Auth → Onboarding → Dashboard → Features
- Breadcrumbs on detail pages
- Course switcher in sidebar
- Bottom tab bar on mobile

### Issues

| Issue | Impact |
|-------|--------|
| No global search | Users can't find specific questions, topics, or files quickly |
| Deep pages lack context | Study session page has no breadcrumb showing which file/section |
| No keyboard shortcut discovery | Shortcuts exist but users don't know about them |
| Sidebar has many items but no grouping | Visual overload on desktop |
| No "recently visited" or "quick actions" | Frequent tasks require multiple clicks |

### Enhancements

1. **Global search (Cmd/Ctrl+K)** — Search across files, sections, questions, topics, and chat threads. This is the single highest-impact navigation improvement.

2. **Keyboard shortcut overlay** — Press `?` to show all available shortcuts. Show shortcut hints on hover for common actions.

3. **Sidebar grouping:**
   ```
   LEARN
     Home
     Library
     Study Sessions

   PRACTICE
     Quiz
     Exam Bank
     Assessment

   TRACK
     Planner
     Dashboard
     Analytics

   CONNECT
     AI Chat
     Study Groups
   ```

4. **Quick actions bar** on home page — "Upload File", "Start Quiz", "Resume Study", "Ask AI" as prominent action cards.

5. **Recent activity feed** — Show last 5 actions: "Completed quiz on Cardiology (82%)", "Uploaded Pharmacology.pdf", etc.

---

## 6. Quiz & Assessment UX

### Strengths
- Keyboard shortcuts (A-D, Enter, Esc)
- Difficulty color-coding
- AI tutor for wrong answers
- Detailed explanations with clinical reasoning
- Confetti for high scores (80%+)

### Issues

| Issue | Impact |
|-------|--------|
| No question count indicator during quiz | Users don't know how many questions remain |
| No hint system before answering | Users must guess blindly, then learn from explanation |
| No question bookmarking | Can't save difficult questions for later review |
| No spaced repetition visibility | Users can't see when topics are due for review |
| Quiz stats lack pacing insights | No "you averaged 45s/question" feedback |
| No question filtering by difficulty | Can't practice only hard questions |
| Assessment can't be saved mid-session | Must complete in one sitting |
| No comparison with peers | No benchmarking ("you're in the top 20%") |

### Enhancements

1. **Quiz progress bar** — "Question 7 of 15" with a visual progress bar at the top.

2. **Hint system** — Before revealing the answer, offer a "Show Hint" button that gives a clinical reasoning nudge without revealing the answer. Costs 50% of the question's XP.

3. **Question bookmarking** — Star/flag questions during quiz to create a "Saved Questions" collection for review.

4. **Spaced repetition dashboard** — Show upcoming review schedule: "5 topics due today, 3 due tomorrow" with direct links.

5. **Post-quiz analytics:**
   ```
   Session Summary
   ├── Score: 12/15 (80%)
   ├── Average time: 42s/question (target: 50s)
   ├── Fastest: Q3 (12s) — Pharmacology
   ├── Slowest: Q11 (98s) — Cardiology
   ├── Improvement: +8% vs. last session
   └── Weak areas: Cardiac arrhythmias (2/3 wrong)
        → [Practice Arrhythmias] [Review Notes]
   ```

6. **Difficulty filter** — Let users choose "Easy only", "Hard only", or "Weak topics only" when starting a quiz.

7. **Assessment save/resume** — Auto-save assessment progress every 5 questions. Show "Resume assessment (Q12/30)" on return.

---

## 7. Study Session UX

### Issues

| Issue | Impact |
|-------|--------|
| No explicit "Done studying" action | Users just navigate away — session feels incomplete |
| Timer has no pause indicator | Unclear if timer is running or paused |
| No section skipping | Must go through linearly |
| AI tutor sometimes unavailable | "Available once your answer syncs" is frustrating |
| No note-taking persistence | Notes taken during study aren't saved per-section |
| No study session summary | No recap of what was covered and time spent |

### Enhancements

1. **Session completion flow:**
   - "Finish Session" button → Summary screen showing:
     - Time spent vs. estimated
     - Sections covered
     - Questions attempted
     - Suggested next action ("Take a quiz on this material" or "Continue to next section")

2. **Enhanced timer:**
   - Large, prominent display with clear play/pause state
   - Pomodoro mode option (25 min study, 5 min break)
   - "You've been studying for 45 minutes — consider a break" notification

3. **Section navigation** — Sidebar showing all sections with completion status. Click to jump.

4. **Persistent notes** — Save notes per section, retrievable from Library. Add "Review my notes" as a study task type.

5. **Ambient focus mode** — Minimize UI chrome, hide sidebar, dim non-essential elements. Optional lo-fi background sounds.

---

## 8. Library & File Management

### Issues

| Issue | Impact |
|-------|--------|
| No file search | Users with many files can't find content |
| No bulk operations | Can't delete or re-analyze multiple files |
| File status labels are unclear | "UPLOADED" vs "PROCESSED" vs "ANALYZED" — what do these mean? |
| No file preview before upload | Can't verify content before committing |
| No file organization (folders/tags) | Flat list becomes unwieldy |
| No re-analysis option for already-analyzed files | Can't improve AI extraction |
| No drag-and-drop reordering | Can't prioritize study order |

### Enhancements

1. **Search and filter bar** — Search by filename, filter by status (Processing, Ready, Error), sort by date/name/size.

2. **Human-readable status labels:**
   | Technical | User-Friendly | Icon |
   |-----------|---------------|------|
   | UPLOADED | Uploaded — waiting for analysis | Clock |
   | PROCESSING | Being analyzed by AI... | Spinner |
   | ANALYZED | Ready to study | Green check |
   | FAILED | Analysis failed — tap to retry | Red warning |

3. **Folder/tag system** — Let users organize files into folders (e.g., "Cardiology", "Pharmacology") or add tags.

4. **Bulk actions toolbar** — Select multiple files → Delete, Re-analyze, Move to folder.

5. **File preview** — Show first page thumbnail and metadata (page count, word count) before and after upload.

---

## 9. AI Chat UX

### Issues

| Issue | Impact |
|-------|--------|
| No response streaming | Full response appears at once — feels slow |
| No conversation search | Can't find previous discussions |
| No thread renaming | All threads named by first message — hard to scan |
| No pinned/favorite threads | Can't save important conversations |
| No suggested follow-up questions | Users must formulate every query from scratch |
| No export/share capability | Can't share useful explanations |
| Detail level selector is hidden | Users don't discover brief/standard/deep modes |

### Enhancements

1. **Response streaming** — Stream tokens in real-time. This is the single highest-impact AI chat improvement.

2. **Suggested follow-ups** — After each AI response, show 2-3 suggested questions:
   - "Can you explain this in simpler terms?"
   - "What are the clinical implications?"
   - "How does this relate to [related topic]?"

3. **Thread management** — Rename, pin, delete, and search across threads.

4. **Smart context indicator** — Show which sections/files are being used as context: "Using: Cardiology.pdf (Sections 3, 7)"

5. **Export** — Copy as markdown, share as link, or export to notes.

6. **Prominent detail level toggle** — Show as segmented control above the input: `Brief | Standard | Deep`

---

## 10. Planner & Scheduling UX

### Issues

| Issue | Impact |
|-------|--------|
| No manual task editing | Users can only regenerate the entire plan |
| No drag-and-drop task rescheduling | Can't move tasks between days |
| No time estimates on tasks | Users don't know how long each task will take |
| No actual vs. estimated time tracking | No learning loop for better estimates |
| No "Today" focus view with timer | Must navigate between planner and study session |
| Catch-up redistribution is invisible | Users don't see what changed |

### Enhancements

1. **Editable tasks** — Click to edit task duration, reassign to a different day, or mark as "won't do."

2. **Drag-and-drop calendar** — Drag tasks between days. Show capacity bar per day (used/available minutes).

3. **Time estimates** — Show estimated minutes per task: "Study Cardiology Ch.3 (~45 min)"

4. **Today focus mode:**
   ```
   Today's Plan (3 tasks, ~2h 15m)
   ┌────────────────────────────────┐
   │ ☐ Study: Pharmacology Ch.2    │ ~45 min  [Start]
   │ ☐ Quiz: Cardiology            │ ~30 min  [Start]
   │ ☐ Review: Anatomy flashcards  │ ~60 min  [Start]
   └────────────────────────────────┘
   Progress: 0/3 complete ▓░░░░░░░░░ 0%
   ```

5. **Catch-up changelog** — When catch-up redistributes tasks, show a diff: "3 overdue tasks moved: Pharmacology → Tomorrow, Anatomy → Wednesday"

---

## 11. Mobile Responsiveness

### Strengths
- Bottom tab bar with safe area insets
- Responsive grid layouts (3 cols → 1 col)
- Proper touch targets (44px minimum)

### Issues

| Issue | Device | Impact |
|-------|--------|--------|
| Exam bank header cramped | 320px screens | Date picker + countdown overlap |
| Task rows too dense | Small phones | Hard to scan/tap |
| Long topic names truncate without tooltip | All mobile | Lost information |
| No pull-to-refresh | All mobile | Users expect native gesture |
| File processing notifier overlaps content | Small screens | Blocks interaction |
| No swipe gestures | All mobile | Missed native interaction patterns |

### Enhancements

1. **Pull-to-refresh** on key pages (Home, Library, Planner).

2. **Swipe gestures:**
   - Swipe right on task → Mark complete
   - Swipe left on file → Delete
   - Swipe between quiz questions

3. **Responsive header stacking** — On small screens, stack header elements vertically instead of forcing them horizontally.

4. **Bottom sheet modals** — Replace center-screen dialogs with bottom sheets on mobile for better thumb reach.

5. **Haptic feedback** — On supported devices, add subtle vibration on quiz answer selection, task completion, and streaks.

---

## 12. Accessibility

### Strengths
- Skip-to-content link
- ARIA labels on most interactive elements
- `role="alert"` on error messages
- `aria-live="polite"` on status updates
- Password strength meter with `role="meter"`
- Semantic HTML with proper heading hierarchy

### Issues

| Issue | WCAG Level | Impact |
|-------|-----------|--------|
| Some icon-only buttons lack `aria-label` | A | Screen readers can't identify actions |
| Color-only status indicators | A | Color-blind users miss status |
| Quiz shortcuts (A-D) may conflict with screen readers | AA | Keyboard conflicts |
| Muted text (#78716c on #fafaf9) borderline contrast | AA | Hard to read for low vision |
| No focus trap in custom modals | AA | Focus escapes dialogs |
| Very small text (10-11px) on some labels | AAA | Readability on mobile |
| No `lang` attribute changes for medical terms | AAA | Pronunciation issues |

### Enhancements

1. **Audit and fix all icon-only buttons** — Add `aria-label` to every button that only contains an icon (send, close, menu, etc.).

2. **Add text labels to color indicators** — Status badges should show text AND color: "Ready ✓" (green), "Failed ✗" (red).

3. **Increase minimum font size** to 12px. Replace all `text-[10px]` and `text-[11px]` with `text-xs` (12px).

4. **Fix contrast ratios** — Ensure all text meets WCAG AA (4.5:1 for normal text, 3:1 for large text). Test muted-foreground in both light and dark themes.

5. **Add keyboard shortcut management** — Let users disable quiz shortcuts, or use a modifier key (Ctrl+A instead of just A) to avoid conflicts.

6. **Focus management in modals** — Ensure focus is trapped within open dialogs and returns to the trigger element on close.

---

## 13. Visual Design & Feedback

### Strengths
- Consistent design language with shadcn/ui
- Two custom fonts (Plus Jakarta Sans body, Space Grotesk headers)
- Dark mode support with proper color tokens
- Confetti celebration for high scores
- Staggered animations on list items

### Issues

| Issue | Impact |
|-------|--------|
| Disabled buttons look too similar to enabled | Users click disabled buttons expecting action |
| No "saved" indicator after edits | Users unsure if changes persisted |
| Streak/XP displays look decorative, not interactive | Users miss gamification features |
| No visual difference between draft and published questions | Confusion about question quality |
| Animations not disabled for `prefers-reduced-motion` at component level | Accessibility |

### Enhancements

1. **Auto-save indicator** — Show "Saving..." → "Saved ✓" in the header when data syncs. Fade after 3 seconds.

2. **Disabled button styling** — Use `cursor-not-allowed` + significantly reduced opacity (0.4 instead of 0.5) + tooltip explaining why disabled.

3. **Gamification visibility:**
   - Make streak counter clickable → shows streak calendar
   - Make XP badge clickable → shows XP breakdown and next milestone
   - Add level/rank system: "Medical Student Lv.7 — 340 XP to next level"

4. **Micro-interactions:**
   - Checkmark animation when completing a task
   - Counter animation when stats update
   - Subtle shake on validation errors
   - Pulse on new notifications

---

## 14. Backend UX Impact

Issues in the backend that directly affect user experience.

### 14.1 Rate Limiting UX
**Current:** "Too many requests. Please wait and try again."
**Problem:** Users don't know how long to wait. The sliding window means wait time varies.
**Enhancement:** Return `retryAfterSeconds` in the error response. Show: "You can try again in 32 seconds" with a countdown.

### 14.2 AI Response Quality
**Current:** Questions with confidence < 0.72 are auto-labeled DRAFT but shown to users without distinction.
**Enhancement:** Mark draft questions visually. Add a "Report question quality" button. Use feedback to retrain.

### 14.3 Partial Failure States
**Current:** If blueprint succeeds but question generation fails, the section shows as "ANALYZED" with 0 questions. Users see an empty quiz.
**Enhancement:** Show section status as "Partially ready — questions are still being generated" with a progress indicator.

### 14.4 Chat Context Limitations
**Current:** Chat context is capped at 6000 characters. Long sections are truncated silently.
**Enhancement:** Show context indicator: "Using 3 of 5 sections as context (limited by size). For better answers, ask about specific sections."

### 14.5 Exam Type Validation
**Current:** Invalid exam types silently default to generic "SBA" format.
**Enhancement:** Validate exam type on input. If invalid, show: "Unknown exam type. Please select from: PLAB 1, PLAB 2, MRCP, USMLE Step 1, USMLE Step 2, MRCGP, Finals."

---

## 15. Enhancement Roadmap

### Phase 1: Trust & Clarity (Weeks 1-3)
*Goal: Users always know what's happening and what to do next.*

| # | Enhancement | Impact | Effort |
|---|------------|--------|--------|
| 1 | Processing progress panel with per-file status | High | Medium |
| 2 | "What's Next" guidance cards on home page | High | Low |
| 3 | Actionable error messages with recovery paths | High | Low |
| 4 | Quiz progress indicator (Q7 of 15) | High | Low |
| 5 | Auto-save indicator ("Saved ✓") | Medium | Low |
| 6 | Stale state detection with client-side timeout | High | Medium |

### Phase 2: Speed & Fluency (Weeks 4-6)
*Goal: The app feels fast and interactions feel natural.*

| # | Enhancement | Impact | Effort |
|---|------------|--------|--------|
| 7 | AI chat response streaming | High | Medium |
| 8 | Global search (Cmd+K) | High | High |
| 9 | Keyboard shortcut overlay (?) | Medium | Low |
| 10 | Pull-to-refresh on mobile | Medium | Low |
| 11 | Bottom sheet modals on mobile | Medium | Medium |
| 12 | Cancellable long-running operations | Medium | Medium |

### Phase 3: Study Effectiveness (Weeks 7-10)
*Goal: Users study smarter, not just more.*

| # | Enhancement | Impact | Effort |
|---|------------|--------|--------|
| 13 | Post-quiz analytics with pacing and trends | High | Medium |
| 14 | Spaced repetition visibility dashboard | High | Medium |
| 15 | Question bookmarking for review | Medium | Low |
| 16 | Study session completion flow with summary | Medium | Medium |
| 17 | Hint system for quiz questions | Medium | Medium |
| 18 | Difficulty filter for quizzes | Medium | Low |

### Phase 4: Power Features (Weeks 11-14)
*Goal: Power users can customize and optimize their workflow.*

| # | Enhancement | Impact | Effort |
|---|------------|--------|--------|
| 19 | Editable/draggable planner tasks | High | High |
| 20 | File search, folders, and bulk actions | Medium | High |
| 21 | Suggested follow-up questions in chat | Medium | Medium |
| 22 | Assessment save/resume | Medium | Medium |
| 23 | Pomodoro timer mode | Low | Low |
| 24 | Chat thread management (rename, pin, search) | Low | Medium |

### Phase 5: Engagement & Retention (Weeks 15-18)
*Goal: Users come back daily and feel rewarded.*

| # | Enhancement | Impact | Effort |
|---|------------|--------|--------|
| 25 | Guided onboarding tour (5-7 steps) | High | Medium |
| 26 | Gamification enhancements (levels, milestones) | Medium | Medium |
| 27 | Recent activity feed | Medium | Low |
| 28 | Weekly progress email/notification | Medium | Medium |
| 29 | Peer benchmarking ("top 20% this week") | Medium | High |
| 30 | Sample course with demo data | Medium | Medium |

### Phase 6: Accessibility & Polish (Ongoing)
*Goal: WCAG AA compliance and inclusive design.*

| # | Enhancement | Impact | Effort |
|---|------------|--------|--------|
| — | Fix all icon-only buttons with aria-labels | High | Low |
| — | Add text labels to color-only indicators | Medium | Low |
| — | Increase minimum font size to 12px | Medium | Low |
| — | Fix contrast ratios in both themes | Medium | Low |
| — | Focus trap in modals | Medium | Medium |
| — | Keyboard shortcut conflict resolution | Low | Low |

---

## Appendix A: Hardcoded Limits Users Should Know About

These limits exist in the backend but are not communicated to users in the UI.

| Limit | Value | User Impact |
|-------|-------|-------------|
| Max file size | 100 MB | Upload rejection without explanation if exceeded |
| Supported file types | PDF, PPTX, DOCX | No error guidance for other formats |
| Max questions per section | 100 | Silent cap on question generation |
| Daily study time range | 30–480 min | Validation error if outside range |
| Max planning window | 365 days | Edge case for long-term planners |
| Rate: question generation | 10 calls/min | Throttled without timing info |
| Rate: chat messages | 15 calls/min | Throttled without timing info |
| Rate: exam bank generation | 3 calls/min | Throttled without timing info |
| Chat context window | ~6000 chars | Truncation without notification |
| Assessment duration | 30–300 min | Hard boundaries without explanation |
| FSRS review interval | 1–365 days | Not visible to users |

**Recommendation:** Surface all user-facing limits in tooltips, validation messages, or a "Limits & Fair Use" page in Settings.

---

## Appendix B: Competitive UX Benchmarks

Features present in competing medical study apps that MedQ lacks:

| Feature | Anki | Amboss | Osmosis | UWorld | MedQ |
|---------|------|--------|---------|--------|------|
| Spaced repetition visibility | ✓ | ✓ | ✓ | — | ✗ |
| Question bookmarking | ✓ | ✓ | ✓ | ✓ | ✗ |
| Peer percentile ranking | — | ✓ | — | ✓ | ✗ |
| Response streaming | — | ✓ | — | — | ✗ |
| Global search | ✓ | ✓ | ✓ | ✓ | ✗ |
| Offline mode | ✓ | ✓ | ✗ | ✗ | Partial |
| Image-based questions | ✓ | ✓ | ✓ | ✓ | ✗ |
| Collaborative annotations | — | ✓ | — | — | ✗ |
| Video content | — | ✓ | ✓ | — | ✗ |
| Flashcard mode | ✓ | ✓ | ✓ | — | ✗ |

**Key differentiators MedQ already has:** Personalized content from user's own materials, adaptive AI scheduling, AI chat with context from uploaded files, weakness-targeted remediation plans.

---

## Appendix C: Quick Wins (< 1 Day Each)

Changes that can be implemented in under a day and have measurable impact:

1. Add "Question X of Y" to quiz header
2. Add `aria-label` to all icon-only buttons
3. Change file status labels to human-readable text
4. Add rate limit `retryAfterSeconds` to error responses
5. Add keyboard shortcut `?` to show shortcut overlay
6. Increase minimum font size from 10px to 12px
7. Add "Saved ✓" indicator after data sync
8. Add exam type tooltip in onboarding
9. Show feasibility warning before schedule generation
10. Add "Next Steps" card to home page based on user state

---

*This audit was conducted on 2026-03-18 by analyzing the complete frontend (Next.js 15, React 19, 50+ components, 18 pages), backend (18 Cloud Functions, 2 AI providers), and data model (10 Firestore collections).*
