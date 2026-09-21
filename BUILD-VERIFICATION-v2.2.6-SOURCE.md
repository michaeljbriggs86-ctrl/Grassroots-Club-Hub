# SUPERSEDED BY v2.2.7 BRAND SYSTEM

# BUILD-VERIFICATION-v2.2.6-SOURCE

**Checked:** 2026-09-19  
**Status:** TESTED at source level — NOT YET BUILT as an inspected APK

## Evidence

- `versionCode 2206` / `versionName 2.2.6`.
- Native user agent marker: `GrassrootsClubHub/2.2.6`.
- Governing UI marker: `approved-app-ui-2026-09-19-v1.1-responsive-imagery`.
- `verification/verify_v2_2_6_responsive_imagery.py`: **42/42 PASS**.
- `cloud.js`, `onboarding.js`, `app.js`, `static-feed-overlay.js`: Node syntax PASS.
- `app-design-system.css` and `cloud.css`: balanced brace structure.
- Four active generated football JPEG assets: **2048 x 740**, ~560 KB each.
- Old low-quality `football-team-huddle.jpg`: removed.
- Old `auth-scene-*.svg`: absent.

## Installed-device defect correction

The v2.2.5 screenshot showed a large blank region above the brand header. Source inspection found that Android `WindowInsets` (physical px) were injected directly as CSS px and the top value could be applied more than once. v2.2.6 converts by display density and applies the auth top inset once at the brand header.

## Responsive checks encoded

- <=374 CSS px small-phone path.
- 600–899 CSS px portrait foldable/tablet path.
- >=900 CSS px large-tablet split layout.
- >=600 CSS px + <=620px-high landscape split layout.
- Short screens retain 54–56px auth controls and scroll.
- Standard app screens prevent horizontal overflow; genuinely wide tables use explicit scroll containers.

## Status boundary

This record proves WRITTEN + TESTED source. It does **not** prove BUILT. BUILT may be recorded only after an APK produced from the exact source archive is downloaded and inspected. DEPLOYED-LIVE requires verification of the actually installed/distributed artifact.
