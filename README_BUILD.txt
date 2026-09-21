PitchKind Android v2.2.8 - GitHub-ready source

Governing app UI: APP-UI-DESIGN-GUIDELINES.md v1.4
Brand extension: BRAND-GUIDELINES.md v1.0
Android version: 2.2.8 (versionCode 2208)
Internal Android namespace/applicationId intentionally remains com.grassrootsclubhub.universal.
Auth deep-link scheme intentionally remains grassrootsclubhub:// for compatibility.
Static-feed URLs intentionally remain on the existing Grassroots-Club-Hub GitHub data path.

Source verification:
  python verification/verify_v2_2_8_pitchkind_ui.py
  node --check app/src/main/assets/cloud.js
  node --check app/src/main/assets/onboarding.js
  node --check app/src/main/assets/app.js
  node --check app/src/main/assets/static-feed-overlay.js

GitHub build:
  The repository contains exactly one APK workflow: .github/workflows/build-apk.yml
  Push to main/master or run it manually from GitHub Actions.
  Download the PitchKind-v2.2.8-debug artifact when the job succeeds.

Status vocabulary:
  WRITTEN: source exists.
  TESTED: source verifier + syntax checks pass.
  BUILT: GitHub Actions produces an APK from these exact bytes and the APK gate passes.
  DEPLOYED/LIVE: not implied by a build.
