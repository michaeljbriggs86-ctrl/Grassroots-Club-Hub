# BUILD-VERIFICATION-v2.2.8-SOURCE

**Checked:** 2026-09-21  
**Status:** TESTED at source level. APK **NOT BUILT in this environment**.

## Source contract verified

- `versionCode 2208` / `versionName 2.2.8`.
- Android namespace/applicationId remains `com.grassrootsclubhub.universal`.
- Auth callback scheme remains `grassrootsclubhub://` for compatibility.
- `ClubHubNative` and the existing static-feed GitHub host/path remain unchanged.
- Android app label, WebView title and PWA manifest now use `PitchKind`.
- Governing UI marker is `approved-app-ui-2026-09-21-v1.4-pitchkind`.
- The six approved `pitchkind-wt_*.svg` files match their Drive source bytes by SHA-256.
- Active UI source contains no retired Grassroots Club Hub visual-asset references, retired tagline, or `More Than A Game` text.
- Splash uses the approved reverse PitchKind lock-up.
- Authentication and club onboarding use the approved primary PitchKind lock-up.
- Missing/unverified club badge fallback uses the PitchKind mark as a neutral product placeholder.
- Demo club data no longer assigns the platform mark as if it were a club badge.
- PWA/Android launcher PNGs are direct conversions of the approved app-icon SVG and dimension-check correctly.
- Authentication/main hero derivatives are 2048x740 and the retired-text region has been removed; provenance is recorded in `IMAGE-PROVENANCE-v2.2.8.md`.
- Exactly one APK-producing GitHub workflow exists: `.github/workflows/build-apk.yml`.
- `APP-UI-DESIGN-GUIDELINES.md` v1.4 and adopted `BRAND-GUIDELINES.md` v1.0 are bundled.

Bundled verifier result: **49/49 passed**.

JavaScript syntax checks passed for:
- `cloud.js`
- `onboarding.js`
- `app.js`
- `static-feed-overlay.js`

Workflow YAML parses successfully.

## Build boundary

This runtime does not provide the Android Gradle/SDK build environment used by the project, so no APK was produced locally. The bundled GitHub Actions workflow installs Android SDK 35 and Gradle 8.9, runs the source verifier and JavaScript syntax checks, builds the debug APK, performs an APK content gate, writes a SHA-256 checksum and uploads the exact artifact.

Under the collaboration protocol, this source is **TESTED**. It becomes **BUILT** only after a GitHub Actions run succeeds and the resulting APK passes the bundled artifact gate. **DEPLOYED/LIVE is not claimed.**
