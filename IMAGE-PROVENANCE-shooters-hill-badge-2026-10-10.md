# Image provenance - Shooters Hill AFC club badge (2026-10-10)

File: `app/src/main/assets/shooters-hill-logo.png`

Decision: on 2026-10-10 Mike directed that the club's own badge artwork (round crest, transparent background) be used in every club-related place in the app.

Source: `SHOOTERS-HILL-AFC_OFFICIAL-BADGE_SECRETARY-SUPPLIED-3500.png` (Drive `98 - UPLOAD INBOX`, file id 1HiIcFumIljGQQjWjb3kDn89c9gsRscn0). 3500x3500 RGBA PNG, 470,088 bytes, SHA-256 `66bc3e506f8e5a7e3caf252b50515ad0ef9daf08e8b96ed6b57766acd10ea0a0`. This is the same file recorded as club 499's `club_supplied_private` badge in `verification/pilot_verified_badges.json` (approved 2026-09-28). The hash was checked against that record before use.

Operation: crop the fully transparent 340 px border (box 340,340,3160,3160; maximum alpha in the removed border was 0, so no artwork was cut). Then downscale 2820x2820 to 512x512 with Lanczos resampling and save as PNG with alpha. The image was not upscaled, recoloured or redrawn.

Result: 512x512 RGBA, 159,239 bytes, SHA-256 `c99b2d689b5da2ca35cbb4f65ddc2051a503e94e6eeecf2d2a547e88d08226c0`. Corners are fully transparent. It passes `verification/verify_club_logo_quality.py` (club-logo-q1).

Replaces: the previous derivative `SHOOTERS-HILL-AFC_APPROVED-BADGE_APP-READY-512.png` (SHA-256 `ea3b232a…71bce`). That file is a 512x512 RGB image with opaque black corners. Its v2.2.20 acceptance depended on a circular CSS crop, which the later "verified badges retain their original outline" rule removed, so the corners showed on test.pitchkind.com. The hash pins in `verification/verify_v2_2_30_pitchkind_ui.py` and `.github/workflows/build-apk.yml` are updated. Older versioned verifiers and the badge catalogue seeds are left as historical records.

Tool: Python Pillow.
