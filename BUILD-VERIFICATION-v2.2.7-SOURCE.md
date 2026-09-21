# BUILD-VERIFICATION-v2.2.7-SOURCE

**Checked:** 2026-09-19  
**Status:** TESTED at source level; APK **NOT BUILT in this environment**.

## Source contract verified

- `versionCode 2207` / `versionName 2.2.7`.
- Native marker `GrassrootsClubHub/2.2.7`.
- Governing UI marker `approved-app-ui-2026-09-19-v1.2-brand-system`.
- Brand-system verifier: **65/65 passed**.
- `cloud.js`, `onboarding.js`, `app.js` and `static-feed-overlay.js` pass `node --check`.
- Required primary/reverse/mark/icon/banner assets exist.
- Android launcher mipmaps were regenerated at all existing density buckets and dimension-checked.
- PWA 192/512/maskable icons were regenerated and manifest/cache references verified.
- Product splash is fixed to the Grassroots Club Hub reverse lock-up and cannot be overwritten by club configuration.
- Missing club badge fallback uses the neutral Grassroots Club Hub mark; configured club badges remain club-specific.

## Build boundary

This runtime does not contain Gradle or Android SDK 35 (`gradle` unavailable; `ANDROID_HOME` unset), so no APK was produced here. Under the collaboration protocol, source testing does **not** justify BUILT or DEPLOYED-LIVE status.

The bundled GitHub workflow has been advanced to v2.2.7 and points at the v2.2.7 verifier, but a workflow definition alone is not build evidence.
