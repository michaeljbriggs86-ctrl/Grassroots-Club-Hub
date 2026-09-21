# SUPERSEDED — Login-only design specification

This file is retained for provenance only. It is superseded by `APP-UI-DESIGN-GUIDELINES.md`, the app-wide governing UI standard effective 2026-09-19. Do not use this file as current implementation authority.

---

# Login design specification — approved 2026-09-19

**Status:** Active UI acceptance specification for v2.2.4 and later until explicitly replaced.

Reference images:
- `APPROVED_LOGIN_MOCKUP_2026-09-19.png`
- `LOGIN_DESIGN_BRIEF_2026-09-19.png`

Design revision marker encoded in the app:

`approved-mockup-2026-09-19-v1`

## Acceptance rule

The approved mock-up is not a mood board. The primary authentication screens in the app must reproduce its visible hierarchy and visual system. A login implementation that merely uses similar colours but adds competing controls, dark legacy cards, different hierarchy, or visually dominant migration options does not satisfy this specification.

## Primary screen family

1. **Adult Login** — default first screen for Club Admins, Coaches, Assistant Coaches and Parents.
2. **Player Access** — separate route using Player Name + reusable Player Code; no player email/contact field.
3. **Create Club Account** — separate Club Sign Up route that continues into universal onboarding.

## Adult Login visible hierarchy

Only these primary elements belong on the normal opening screen:

1. Grassroots Club Hub shield/football branding.
2. Football pitch hero visual and handwritten `More Than A Game` accent.
3. `Welcome Back` heading.
4. `Admins, Coaches and Parents sign in with email and password.` supporting copy.
5. Email address field.
6. Password field with show/hide affordance.
7. `Forgot password?` action.
8. Full-width green `Log In` CTA.
9. Outlined `Player Login` CTA.
10. `Club Sign Up` text action.
11. Divider.
12. `One login page for all adult users — you’ll be redirected to the right account after sign in.`
13. Grass/footer treatment.

Migration-only PIN/invite/setup links must not be shown on this default screen. Legacy/recovery paths may exist as state-driven secondary screens.

## Player Access visible hierarchy

- Branding and football-player hero visual.
- Handwritten `Same Team Brighter Tomorrow` accent.
- `Player Access` heading.
- `No email required.` support copy.
- Player Name field.
- Player Code field.
- Pale-green safeguarding explanation.
- Full-width green `Enter App` CTA.
- `Back to Main Login` link.
- Grass/footer treatment.

Product boundary: player access remains restricted to eligible U15 squads under the current architecture.

## Create Club Account visible hierarchy

- Branding and clubhouse hero visual.
- Handwritten `Stronger Clubs Stronger Communities` accent.
- `Create Club Account` heading.
- `Set up your club and start inviting coaches, parents and players.` support copy.
- Club Name field.
- Email address field.
- Password field with show/hide affordance.
- County FA / League selector.
- Full-width green `Create Club` CTA.
- `Already have an account? Log In` action.
- Pale-green organisation information panel.
- Grass/footer treatment.

## Encoded visual rules

The live source must preserve the tokenised implementation in `app/src/main/assets/cloud.css`:

- light canvas: `--auth-canvas: #f3f6f4`
- primary deep green: `--auth-green-900: #0b5d35`
- action green family: `--auth-green-700/600/500`
- black/near-black page headings: `--auth-ink`
- restrained supporting grey/green copy: `--auth-copy`, `--auth-muted`
- rounded field radius: `--auth-radius-field`
- rounded CTA radius: `--auth-radius-button`
- principal phone-screen composition: `--auth-screen-max: 430px`
- full-width green primary CTA
- outlined green Player Login CTA
- pale-green safety/info cards
- scene assets: `auth-scene-adult.svg`, `auth-scene-player.svg`, `auth-scene-club.svg`
- grass footer treatment

## Regression rule

Changes to the primary auth DOM/CSS must keep the design-revision acceptance checks passing. If a new design is approved later, change the design revision marker and the acceptance checks deliberately; do not silently drift from this mock-up.
