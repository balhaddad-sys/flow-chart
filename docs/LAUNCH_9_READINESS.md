# Launch 9/10 Readiness

This repo includes an automated launch gate that scores five areas:

- Ops Reliability
- Clinical Quality
- UX Brand
- Core Product
- Trust Compliance

The gate fails unless every category is >= 9.0 and overall score is >= 9.0.

## Local run

```powershell
./scripts/launch-readiness.ps1 -SkipDeploySmoke
```

With deployed health check:

```powershell
./scripts/launch-readiness.ps1 -HealthCheckUrl "https://us-central1-medq-a6cc6.cloudfunctions.net/healthCheck"
```

Fast mode (quick precheck):

```powershell
./scripts/launch-readiness.ps1 -Fast -SkipWebBuild -SkipDeploySmoke
```

## GitHub Actions run

Use workflow: `Launch Readiness Gate`

- Trigger: `workflow_dispatch`
- Optional input: `healthcheck_url`
- Optional toggles: `fast_mode`, `skip_web_build`

The workflow runs `scripts/launch-readiness.ps1` and exits non-zero on gate failure.

