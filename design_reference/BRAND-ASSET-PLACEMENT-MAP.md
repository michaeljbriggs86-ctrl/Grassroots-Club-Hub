# Grassroots Club Hub — Brand Asset Placement Map

**Status:** WRITTEN — implementation map for v2.2.7  
**Checked:** 2026-09-19  
**Governing standard:** `APP-UI-DESIGN-GUIDELINES-v1.2.md`

## Approved product assets

| Asset | Purpose | Built into |
|---|---|---|
| `gch-logo-primary.svg` | Full dark-green product lock-up | Authentication, legacy activation gate, light product surfaces |
| `gch-logo-reverse.svg` | Full reverse product lock-up | App splash / dark product surfaces |
| `gch-mark.svg` | Compact grass-O product mark | Missing/unverified club-badge fallback |
| `gch-app-icon.svg` + PNG derivatives | Product launcher icon | Android mipmaps, PWA 192/512/maskable icons |
| `gch-banner.svg` | Wide product banner | Club-creation onboarding and Settings/About |

Official text: **Grassroots Club Hub**  
Official tagline: **CONNECT • ORGANISE • GROW THE GAME**

## Placement boundary

Product brand belongs on platform-level surfaces: launcher, splash, authentication, onboarding, About/settings and neutral fallback states. A selected club's verified badge remains the identity on signed-in club/team headers and other club-specific surfaces. `applyClubConfiguration()` must never overwrite the product splash or auth branding.

## Deliberately not replaced

- club badge upload/preview in onboarding;
- configured club badge in signed-in headers;
- team/club identity in fixtures/results/tables when a verified club badge exists;
- generated photographic football hero imagery.

These remain separate because the Grassroots Club Hub logo identifies the software platform, not the football club using it.
