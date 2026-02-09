# MedQ — Adaptive Medical Study Companion

An intelligent, adaptive study platform for medical students. MedQ uses AI to analyze study materials, generate personalized quiz questions, create adaptive study schedules, and provide intelligent tutoring feedback.

## Features

- **Smart Document Processing** — Upload PDF, PPTX, or DOCX study materials. MedQ extracts content and generates structured topic blueprints using AI.
- **Adaptive Quiz Engine** — AI-generated single-best-answer (SBA) questions with difficulty-weighted distribution, detailed explanations, and tutor feedback on incorrect answers.
- **Intelligent Scheduling** — Personalized study plans based on exam date, daily availability, revision policy, and material difficulty. Automatic catch-up scheduling for missed days.
- **Weakness Analysis** — Tracks per-topic performance and identifies weak areas. AI generates targeted fix plans for remediation.
- **Study Sessions** — Integrated PDF viewer with session timer and progress tracking.
- **Cross-Platform** — Flutter-based PWA that runs on web, iOS, and Android.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Flutter Web App                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │   Auth   │ │   Home   │ │  Library  │ │  Planner  │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └─────┬─────┘  │
│  ┌────┴─────┐ ┌────┴─────┐ ┌────┴─────┐ ┌─────┴─────┐  │
│  │   Quiz   │ │  Study   │ │Dashboard │ │Onboarding │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
│                Riverpod State Management                │
│                   GoRouter Navigation                   │
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
          │  │  Questions     │  │  ← AI question generation
          │  │  Analytics     │  │  ← Weakness computation
          │  │  AI Client     │  │  ← Claude API integration
          │  └────────────────┘  │
          └──────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Flutter 3.x (Dart) |
| State Management | Riverpod |
| Routing | GoRouter |
| Backend | Firebase Cloud Functions (Node.js 20) |
| Database | Cloud Firestore |
| File Storage | Firebase Cloud Storage |
| Authentication | Firebase Auth (Email + Google Sign-In) |
| AI | Claude API (Anthropic SDK) |
| CI/CD | GitHub Actions → Firebase Hosting |

## Getting Started

### Prerequisites

- [Flutter SDK](https://docs.flutter.dev/get-started/install) (stable channel, ≥3.2.0)
- [Node.js](https://nodejs.org/) 20.x
- [Firebase CLI](https://firebase.google.com/docs/cli) (`npm install -g firebase-tools`)
- A Firebase project with Firestore, Storage, Auth, and Cloud Functions enabled
- An [Anthropic API key](https://console.anthropic.com/) for Claude AI features

### 1. Clone and install dependencies

```bash
git clone <repository-url>
cd flow-chart

# Flutter dependencies
flutter pub get

# Generate Freezed / JSON serializable code
dart run build_runner build --delete-conflicting-outputs

# Cloud Functions dependencies
cd functions && npm install && cd ..
```

### 2. Configure Firebase

```bash
# Login to Firebase
firebase login

# Initialize project (select existing project or create new)
firebase use --add
```

Create `lib/firebase_options.dart` using the FlutterFire CLI:

```bash
dart pub global activate flutterfire_cli
flutterfire configure
```

### 3. Set environment variables

For Cloud Functions, set the Anthropic API key:

```bash
firebase functions:secrets:set ANTHROPIC_API_KEY
```

### 4. Run locally with emulators

```bash
# Start Firebase emulators
firebase emulators:start

# In a separate terminal, run the Flutter app
flutter run -d chrome
```

### 5. Deploy

```bash
# Build Flutter web
flutter build web --release

# Deploy everything
firebase deploy
```

## Project Structure

```
lib/
├── main.dart                    # App entry point
├── firebase_options.dart        # Firebase config (generated)
└── src/
    ├── app.dart                 # MaterialApp with routing
    ├── models/                  # Freezed data models (9 models)
    ├── core/
    │   ├── constants/           # Colors, spacing, typography
    │   ├── providers/           # Core Riverpod providers
    │   ├── services/            # Auth, Firestore, Storage, Functions, Cache
    │   ├── utils/               # Validators, error handling, date utils
    │   └── widgets/             # Reusable UI components
    └── features/
        ├── auth/                # Login & signup
        ├── onboarding/          # 4-step course setup wizard
        ├── home/                # Dashboard with stats & today's plan
        ├── library/             # File upload & section management
        ├── planner/             # Calendar task planner
        ├── quiz/                # Quiz engine with AI tutoring
        ├── study_session/       # PDF viewer with timer
        └── dashboard/           # Weakness analysis & fix plans

functions/
├── index.js                     # Function exports
├── processing/                  # Document extraction pipeline
│   ├── extractors/              # PDF, PPTX, DOCX extractors
│   ├── processFile.js           # Storage trigger: extract on upload
│   ├── processSection.js        # Firestore trigger: AI blueprint
│   └── processDocumentBatch.js  # Vision-based batch extraction
├── questions/                   # Question generation & quiz serving
├── scheduling/                  # Study plan generation & catch-up
├── analytics/                   # Attempt logging & weakness computation
├── ai/                          # Claude API client & prompt templates
└── admin/                       # User deletion & health check
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

## Cloud Functions

| Function | Trigger | Description |
|----------|---------|-------------|
| `processUploadedFile` | Storage onFinalize | Extracts text from uploaded documents |
| `processSection` | Firestore onCreate | Generates AI blueprint for sections |
| `processDocumentBatch` | Callable | Vision-based batch page extraction |
| `generateSchedule` | Callable | Creates adaptive study schedule |
| `regenSchedule` | Callable | Regenerates schedule keeping completed tasks |
| `catchUp` | Callable | Redistributes overdue tasks |
| `generateQuestions` | Callable | AI-generates SBA questions for a section |
| `getQuiz` | Callable | Fetches quiz questions with filtering |
| `submitAttempt` | Callable | Logs attempt and returns tutor feedback |
| `computeWeakness` | Firestore onCreate | Recomputes weakness scores on new attempts |
| `deleteUserData` | Callable | GDPR-compliant full data deletion |
| `healthCheck` | HTTP | Service health endpoint |

## Testing

```bash
# Flutter unit & widget tests
flutter test

# Flutter tests with coverage
flutter test --coverage

# Cloud Functions tests
cd functions && npm test
```

## Environment Variables

| Variable | Where | Description |
|----------|-------|-------------|
| `ANTHROPIC_API_KEY` | Cloud Functions secret | Claude API key for AI features |
| `FIREBASE_SERVICE_ACCOUNT` | GitHub Actions secret | Service account for CI/CD deployment |

## Security

- All Firestore data is scoped to `users/{uid}` with ownership-based access control
- Cloud Storage enforces file type whitelisting and 100MB size limit
- Cloud Functions validate authentication and sanitize inputs
- Rate limiting protects AI-powered endpoints from abuse
- GDPR-compliant data deletion via `deleteUserData` function

## License

Proprietary. All rights reserved.
