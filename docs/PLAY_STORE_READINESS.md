# Play Store Readiness Guide (Flutter Android)

This project currently ships web and backend production paths. To publish Android to Google Play, complete this checklist.

## 1) Bootstrap Android Platform

Run from repo root:

```powershell
.\scripts\playstore-bootstrap.ps1
```

This will create `android/` if missing and add `android/key.properties.example`.

If Flutter is not installed on your machine, install Flutter SDK first:

https://docs.flutter.dev/get-started/install

## 2) Configure Firebase for Android

1. In Firebase Console, add an **Android app** to project `medq-a6cc6`.
2. Use your production package name.
3. Download `google-services.json` into:

`android/app/google-services.json`

4. Export these environment variables before build:

- `FIREBASE_ANDROID_API_KEY`
- `FIREBASE_ANDROID_APP_ID`
- `FIREBASE_ANDROID_MESSAGING_SENDER_ID`
- `FIREBASE_ANDROID_PROJECT_ID` (optional if default project is used)
- `FIREBASE_ANDROID_STORAGE_BUCKET` (optional if default bucket is used)

## 3) Configure Signing (Required by Play)

1. Create upload keystore:

```powershell
.\scripts\create-upload-keystore.ps1
```

2. Create `android/key.properties` from template:

`android/key.properties.example`

3. Never commit:

- `android/key.properties`
- `android/app/upload-keystore.jks`

## 4) Build Release AAB

```powershell
.\scripts\build-android-aab.ps1 -BuildName 1.0.0 -BuildNumber 10
```

Output:

`build/app/outputs/bundle/release/app-release.aab`

## 5) Legal and Policy Requirements

Before submitting to Play Console:

- Privacy policy URL is reachable and public.
- Terms URL is reachable and public.
- Data Safety form completed correctly (Auth, user content, analytics, storage).
- Content rating questionnaire completed.
- App access instructions included if login is required.
- Test credentials prepared for Play review.

Use template: `docs/PLAY_REVIEW_APP_ACCESS_TEMPLATE.md`

The app reads legal links from Dart defines:

- `MEDQ_PRIVACY_URL`
- `MEDQ_TERMS_URL`
- `MEDQ_SUPPORT_EMAIL`

## 6) Recommended Release Process

1. Upload to **Internal testing** first.
2. Resolve all Android Vitals warnings.
3. Run closed testing with real users.
4. Promote to Production after crash-free verification.

## 7) CI (GitHub Actions)

Use `.github/workflows/android-release.yml` to build signed AAB artifacts from tags or manual runs.

Required repository secrets:

- `ANDROID_UPLOAD_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `FIREBASE_ANDROID_API_KEY`
- `FIREBASE_ANDROID_APP_ID`
- `FIREBASE_ANDROID_MESSAGING_SENDER_ID`
- `FIREBASE_ANDROID_PROJECT_ID`
- `FIREBASE_ANDROID_STORAGE_BUCKET`
- `MEDQ_PRIVACY_URL`
- `MEDQ_TERMS_URL`
- `MEDQ_SUPPORT_EMAIL`

## 8) Automated Preflight Check

Use this local script before creating a release:

```powershell
.\scripts\check-playstore-readiness.ps1 `
  -PrivacyUrl https://your-domain/privacy `
  -TermsUrl https://your-domain/terms
```

It validates required files, secret-safe gitignore paths, Android release pipeline,
and legal URL reachability.
