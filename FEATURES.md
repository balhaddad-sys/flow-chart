# MedQ — Feature Overview

**MedQ is an AI-powered medical study platform that turns your lecture materials into a personalised, adaptive study experience.**

---

## Core Features

### 1. Smart Document Processing
Upload your PDFs, PowerPoints, or Word documents. MedQ's AI reads, extracts, and structures your content into study-ready sections — automatically identifying key concepts, learning objectives, high-yield points, and common exam traps.

- Supports PDF, PPTX, and DOCX (up to 100 MB)
- Drag-and-drop or tap to upload
- Real-time processing progress with status updates
- Retry failed sections with one tap

### 2. Adaptive Quiz Engine
AI-generated single-best-answer (SBA) questions tailored to your exact study materials. Questions are calibrated for your target exam — PLAB 1/2, MRCP, USMLE Step 1/2, MRCGP, or Finals.

- Difficulty levels 1–5, colour-coded
- Keyboard shortcuts (A–D, Enter, Esc) for fast answering
- Detailed explanations with clinical reasoning
- AI Tutor: ask follow-up questions on any answer
- Flag questions for review
- Exam-specific formatting (UK drug names for PLAB, US for USMLE, etc.)

### 3. Intelligent Study Scheduling
A personalised day-by-day study plan built from your materials, availability, and exam date. Uses spaced repetition (FSRS v5) to schedule reviews at the optimal moment.

- Three task types: Study, Questions, Review
- Per-day availability customisation
- Automatic catch-up redistribution for missed days
- Feasibility warnings when time is tight
- Progress tracking with completion rings

### 4. Weakness Analysis & Remediation
Real-time tracking of your performance across every topic. When weaknesses emerge, MedQ generates a targeted fix plan to close the gaps.

- Per-topic accuracy and attempt tracking
- Visual analytics with charts and breakdowns
- AI-generated diagnostic directives ("Critical gap in cardiology — prioritise...")
- One-tap remediation plan generation
- Priority-ordered fix tasks with estimated minutes

### 5. AI Study Chat
A context-aware AI assistant that knows your study materials. Ask questions, get explanations, and explore topics — with citations back to your uploaded content.

- Threaded conversations with full history
- Citations referencing your specific sections
- Evidence references (PubMed, UpToDate, Medscape links)
- Configurable detail levels: brief, standard, deep
- Clinically nuanced mode for advanced learners

### 6. Explore Mode
Discover and study topics beyond your uploaded materials. Enter any medical topic and get a structured learning experience: outline, key concepts, and practice questions — all AI-generated.

- Topic exploration with learning outlines
- AI-generated practice questions on any topic
- Learning progression: Learn, Practice, Review
- Session history tracking

### 7. Study Sessions
Focused study sessions with a built-in timer, PDF viewer, and integrated questions — all on one screen.

- Three-tab interface: Study Materials, Questions, Review
- Countdown timer with pause/resume
- AI tutor sidebar for in-context help
- Notes taking capability
- Time-spent analytics vs estimated time

### 8. Study Groups
Create or join study groups with invite codes. Study together and track each other's progress.

- Create groups with name and description
- 6-character invite codes, shareable with one tap
- Member list with owner badge
- Group quiz challenges (coming soon)

### 9. Exam Bank
Practice with curated exam-style questions from a growing bank of sample questions across major medical exams.

- PLAB 1, PLAB 2, MRCP, USMLE, MRCGP, Finals
- Progress tracking across sessions
- Reset progress option

### 10. Assessment Mode
Take structured diagnostic assessments to benchmark your knowledge on specific topics and difficulty levels.

- Topic and difficulty selection
- Timed assessment sessions
- Performance reports with recommendations
- Remediation suggestions based on results

---

## Platform Features

### Multi-Platform
- **Web App** — works in any modern browser
- **PWA** — install on your phone or desktop for a native-like experience
- **Android App** — available on the Play Store
- **Offline-ready** — standalone mode with local data persistence

### Personalisation
- Light and dark mode with system preference detection
- Customisable daily study availability
- Multiple exam type support per course
- Keyboard shortcuts throughout

### Privacy & Security
- Your data stays yours — all files stored in your private Firebase bucket
- No cross-user data access (enforced at database rule level)
- Full GDPR compliance — delete all your data with one action
- HTTPS everywhere with strict Content Security Policy
- No tracking cookies, no third-party analytics

### Accessibility
- Skip-to-content link
- Keyboard-navigable throughout
- ARIA labels on all interactive elements
- Semantic HTML with proper heading hierarchy
- Screen reader friendly status updates
- 44px minimum touch targets on mobile

---

## Technical Highlights

- Built with Next.js 15, React 19, and TypeScript
- Firebase backend (Firestore, Auth, Storage, Cloud Functions)
- AI powered by Claude (Anthropic) and Gemini (Google)
- Spaced repetition via FSRS v5 algorithm
- Real-time data sync via Firestore listeners
- 32,000+ lines of automated tests
- CI/CD with automated deployment and health checks
