# MedQ — Adaptive Medical Study Companion

An intelligent, adaptive study platform for medical students. MedQ uses AI to analyze study materials, generate personalized quiz questions, create adaptive study schedules, and provide intelligent tutoring feedback.

## Features

- **Smart Document Processing** — Upload PDF, PPTX, or DOCX study materials. MedQ extracts content and generates structured topic blueprints using AI.
- **Adaptive Quiz Engine** — AI-generated single-best-answer (SBA) questions with difficulty-weighted distribution, detailed explanations, and tutor feedback on incorrect answers.
- **Intelligent Scheduling** — Personalized study plans based on exam date, daily availability, revision policy, and material difficulty. Automatic catch-up scheduling for missed days.
- **Weakness Analysis** — Tracks per-topic performance and identifies weak areas. AI generates targeted fix plans for remediation.
- **AI Study Chat** — Context-aware AI assistant that answers questions using your uploaded study material.
- **Study Groups** — Create or join study groups with invite codes for collaborative learning.
- **Study Sessions** — Integrated PDF viewer with session timer and progress tracking.
- **PWA Installable** — Works on desktop and mobile as an installable app.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Next.js 15 Web App                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │   Auth   │ │   Home   │ │  Library  │ │  Planner  │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └─────┬─────┘  │
│  ┌────┴─────┐ ┌────┴─────┐ ┌────┴─────┐ ┌─────┴─────┐  │
│  │   Quiz   │ │  Study   │ │Dashboard │ │   Chat    │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
│              Zustand State Management                   │
│              Next.js App Router Navigation              │
└─────────────────────┬───────────────────────────────────┘
                      │
          ┌───────────┼───────────────┐
          ▼           ▼               ▼
   ┌────────────┐ ┌────────┐  ┌──────────────┐
   │  Firebase   │ │Firebase│  │   Firebase    │
   │  Firestore  │ │  Auth  │  │   Storage     │
   └──────┬─────┘ └────────┘  └──────┬───────┘
          │                          │
          └──────────┬───────────────┘
                     ▼
          ┌──────────────────────┐
          │   Cloud Functions    │
          │  ┌────────────────┐  │
          │  │  Processing    │  │  ← Document extraction pipeline
          │  │  Scheduling    │  │  ← Adaptive study plan generation
          │  │  Questions     │  │  ← AI question generation + tutoring
          │  │  Analytics     │  │  ← Weakness computation + fix plans
          │  │  Chat          │  │  ← AI study assistant
          │  │  AI Clients    │  │  ← Gemini + Claude integration
          │  └────────────────┘  │
          └──────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (React 19, TypeScript) |
| State Management | Zustand |
| Routing | Next.js App Router |
| UI Components | shadcn/ui + Tailwind CSS |
| Backend | Firebase Cloud Functions (Node.js 20) |
| Database | Cloud Firestore |
| File Storage | Firebase Cloud Storage |
| Authentication | Firebase Auth (Email + Google Sign-In) |
| AI (Analysis) | Gemini 2.0 Flash (document blueprints, questions, vision OCR) |
| AI (Callable) | Claude Haiku 4.5 (tutoring, chat, fix plans) |
| Web Hosting | Vercel |
| CI/CD | GitHub Actions → Firebase (functions/rules) + Vercel (web) |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20.x
- [Firebase CLI](https://firebase.google.com/docs/cli) (`npm install -g firebase-tools`)
- A Firebase project with Firestore, Storage, Auth, and Cloud Functions enabled
- A [Gemini API key](https://aistudio.google.com/apikey) for document analysis and question generation
- An [Anthropic API key](https://console.anthropic.com/) for tutoring, chat, and fix plans

### 1. Clone and install dependencies

```bash
git clone <repository-url>
cd flow-chart

# Next.js frontend
cd medq-web && npm install && cd ..

# Cloud Functions
cd functions && npm install && cd ..
```

### 2. Configure Firebase

```bash
firebase login
firebase use --add
```

Create `medq-web/.env.local` with your Firebase config:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

### 3. Set environment secrets

```bash
firebase functions:secrets:set GEMINI_API_KEY
firebase functions:secrets:set ANTHROPIC_API_KEY
```

### 4. Run locally

```bash
# Start the Next.js dev server
cd medq-web && npm run dev

# (Optional) Start Firebase emulators in another terminal
firebase emulators:start
```

### 5. Deploy

```bash
# Deploy Cloud Functions, Firestore rules, and Storage rules
firebase deploy --only functions,firestore,storage

# Web app deploys automatically via Vercel on git push
```

### 6. Android / Play Store Release

This repo is set up for web-first delivery and supports Android release builds for Google Play.

```powershell
# Bootstrap android/ if missing
.\scripts\playstore-bootstrap.ps1

# Build signed AAB (requires keystore + Firebase Android defines)
.\scripts\build-android-aab.ps1 -BuildName 1.0.0 -BuildNumber 10
```

Detailed guide: `docs/PLAY_STORE_READINESS.md`

## Project Structure

```
medq-web/
├── src/
│   ├── app/
│   │   ├── (app)/              # Authenticated app routes (18 pages)
│   │   │   ├── home/           # Dashboard with stats & today's plan
│   │   │   ├── library/        # File upload & section management
│   │   │   ├── planner/        # Calendar task planner
│   │   │   ├── quiz/           # Quiz engine with AI tutoring
│   │   │   ├── study/          # PDF viewer with timer
│   │   │   ├── chat/           # AI study assistant
│   │   │   ├── dashboard/      # Weakness analysis & fix plans
│   │   │   ├── groups/         # Study groups
│   │   │   ├── analytics/      # Performance analytics
│   │   │   ├── insights/       # Study insights
│   │   │   └── settings/       # Account settings
│   │   ├── login/              # Auth page
│   │   └── onboarding/         # 4-step course setup wizard
│   ├── components/             # Reusable UI components
│   ├── lib/
│   │   ├── firebase/           # Firebase client, Firestore queries, function wrappers
│   │   ├── hooks/              # React hooks (useAuth, useFiles, useSections, etc.)
│   │   ├── stores/             # Zustand stores (course, quiz, onboarding)
│   │   └── types/              # TypeScript type definitions
│   └── styles/                 # Global CSS + Tailwind config

functions/
├── index.js                    # Function exports (18 functions)
├── processing/                 # Document extraction pipeline
│   ├── processFile.js          # Storage trigger: extract on upload
│   ├── processSection.js       # Firestore trigger: AI blueprint
│   ├── processDocumentBatch.js # Vision-based batch extraction
│   └── retryFailedSections.js  # Retry failed section analysis
├── questions/                  # Question generation & quiz serving
├── scheduling/                 # Study plan generation & catch-up
├── analytics/                  # Attempt logging & weakness computation
├── chat/                       # AI study assistant
├── ai/                         # Gemini + Claude API clients & prompts
├── admin/                      # Course management, file deletion, health check
├── middleware/                  # Auth validation, rate limiting
└── lib/                        # Shared utilities (Firestore, errors, logger, constants)
```

## Data Model

| Collection | Description |
|-----------|-------------|
| `users/{uid}` | User profile and preferences |
| `users/{uid}/courses` | Courses with exam dates and availability |
| `users/{uid}/files` | Uploaded study materials |
| `users/{uid}/sections` | Extracted sections with AI blueprints |
| `users/{uid}/tasks` | Scheduled study, quiz, and review tasks |
| `users/{uid}/questions` | AI-generated SBA questions |
| `users/{uid}/attempts` | Quiz attempt records |
| `users/{uid}/stats` | Aggregated course statistics |
| `users/{uid}/chatThreads` | AI chat conversation threads |
| `users/{uid}/chatMessages` | Chat messages (user + assistant) |
| `studyGroups/{groupId}` | Study groups with invite codes |

## Cloud Functions

| Function | Trigger | Description |
|----------|---------|-------------|
| `processUploadedFile` | Storage onFinalize | Extracts text from uploaded documents |
| `processSection` | Firestore onCreate | Generates AI blueprint for sections |
| `processDocumentBatch` | Callable | Vision-based batch page extraction |
| `retryFailedSections` | Callable | Retry failed section analysis |
| `generateSchedule` | Callable | Creates adaptive study schedule |
| `regenSchedule` | Callable | Regenerates schedule keeping completed tasks |
| `catchUp` | Callable | Redistributes overdue tasks |
| `generateQuestions` | Callable | AI-generates SBA questions for a section |
| `getQuiz` | Callable | Fetches quiz questions with filtering |
| `submitAttempt` | Callable | Logs attempt and returns tutor feedback |
| `getTutorHelp` | Callable | AI tutoring for missed questions |
| `computeWeakness` | Firestore onCreate | Recomputes weakness scores on new attempts |
| `runFixPlan` | Callable | AI-generates targeted remediation plan |
| `sendChatMessage` | Callable | AI chat with section context |
| `createCourse` | Callable | Creates a new course |
| `deleteFile` | Callable | Cascade-deletes file, sections, questions, and storage |
| `deleteUserData` | Callable | GDPR-compliant full data deletion |
| `healthCheck` | HTTP | Service health endpoint |

## Testing

```bash
# Next.js build check
cd medq-web && npx next build

# Cloud Functions tests
cd functions && npm test
```

## Environment Variables

| Variable | Where | Description |
|----------|-------|-------------|
| `GEMINI_API_KEY` | Cloud Functions secret | Gemini API key for document analysis and question generation |
| `ANTHROPIC_API_KEY` | Cloud Functions secret | Claude API key for tutoring, chat, and fix plans |
| `FIREBASE_SERVICE_ACCOUNT` | GitHub Actions secret | Service account JSON for CI/CD deployment |
| `NEXT_PUBLIC_FIREBASE_*` | `medq-web/.env.local` | Firebase client config (6 variables) |

## Security

- All Firestore data is scoped to `users/{uid}` with ownership-based access control
- Study groups restrict updates to members only
- Cloud Storage enforces file type whitelisting and 100MB size limit
- Cloud Functions validate authentication and sanitize inputs
- Rate limiting protects AI-powered endpoints from abuse
- GDPR-compliant data deletion via `deleteUserData` function

## License

Proprietary. All rights reserved.
