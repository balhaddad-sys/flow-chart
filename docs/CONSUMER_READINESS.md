# Consumer Readiness Checklist

Use this checklist before each production release.

## Product Safety

- Medical safety notice is visible in-app (Settings > Medical Safety Notice).
- Auth screens show legal + educational-use footer.
- Privacy policy and terms links are reachable over HTTPS.
- Account deletion and full data deletion are available in-app.

## Reliability

- Flutter app uses Cloud Functions retry + timeout handling for transient backend failures.
- Firebase backend tests pass.
- Web lint/build pass for production (`medq-web`).

## Security

- `android/key.properties`, keystore, and `google-services.json` are gitignored.
- Firebase rules deployed from reviewed branch.
- API keys and signing secrets are only in secret stores (not committed).

## Play Store Submission

- Android AAB built from signed release configuration.
- Play Data safety form completed accurately.
- Content rating questionnaire completed.
- App access instructions and reviewer credentials prepared.
- Contact support email set and monitored.

## Automation

Run local preflight:

```powershell
.\scripts\check-playstore-readiness.ps1 `
  -PrivacyUrl https://your-domain/privacy `
  -TermsUrl https://your-domain/terms
```
