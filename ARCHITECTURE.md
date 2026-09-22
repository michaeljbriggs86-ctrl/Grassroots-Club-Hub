# PitchKind - Data Architecture Reference

**Document state:** Current governing architecture reference in `00 - CURRENT MASTER`. The GitHub-root copy is a mirror; its presence and byte parity must be checked independently after any Termux push.
**Last updated:** 2026-09-22
**Collaboration rules:** `AI-COLLABORATION-PROTOCOL.md`
**Product name:** PitchKind (formerly Grassroots Club Hub). Mike authorised the visible PitchKind identity implementation on 2026-09-21. Internal identifiers including `com.grassrootsclubhub.universal`, the `grassrootsclubhub://` scheme, `ClubHubNative`, existing feed/repository paths, localStorage keys and `GCH-PIN` remain unchanged unless separately authorised. Trade-mark clearance is NOT completed.
**Brand/UI authority:** `APP-UI-DESIGN-GUIDELINES.md` v1.4 governs anything the app shows. `BRAND-GUIDELINES.md` v1.0 is its cross-platform extension; where they conflict on app surfaces, the app guidelines win.

This document governs data scope, source-of-truth decisions, Selkent integration,
Android acquisition, private/public boundaries, identity, publication safety,
and migration/cutover rules.

All feature/integration status claims use the protocol vocabulary:
**PLANNED / WRITTEN / TESTED / BUILT / DEPLOYED-LIVE**.
A BUILT or DEPLOYED-LIVE claim must be backed by the actual artifact or running
system, not only source code or a workflow definition.

---

# 0. Revision and conflict protocol

Before implementation continues, revise this document whenever architecture and
observed reality diverge.

If two documents or two AIs make conflicting status claims:

1. record the conflict;
2. inspect the same underlying evidence;
3. update this canonical document;
4. only then continue implementation.

`00 - CURRENT MASTER` is the canonical document location. Planning/TODO copies
that conflict with this file must be marked superseded or archived.

---

# 1. Current evidence-backed status — checked 2026-09-22

The source-of-truth categories in Section 2 remain unchanged. This section supersedes older dated build/fixture snapshots elsewhere in this document when they describe the same release.

| Area | Status | Evidence / boundary |
|---|---|---|
| Public Selkent directory and standings | **TESTED feed / BUILT in inspected earlier APKs** | Static directory and U12+ standings integration was inspected in earlier APKs. The current published feed has 15 age groups; no new category of private data is added. |
| All-age public fixtures | **TESTED feed; static Android path device-tested in v2.2.11** | The 2026-09-22 18:05 UTC `data/results.json` on GitHub main is schema v2, with 1,160 fixture rows across 15 age groups. U9 has 44 rows, `fixture_week_ids: [2,3]`, and `verified_multiweek_fixture_rows_v2`. The provider week IDs are discovered for every age group, fetched and deduplicated. Mike's v2.2.11 on-device Next Match check passed; independent v2.2.15–16 device acceptance is not established. |
| U12+ published-results static cutover | **PLANNED** | Current feed still declares `awaiting_verified_nonempty_result_sample`. Real populated result rows must be captured and verified before cutover. |
| PitchKind Android v2.2.15 source and CI | **TESTED source / artifact generated; independent BUILT verification pending** | Commit `b42911e566b257ccde2da9d7298a6df75eacdba8`; Actions run `35761515223` succeeded and published artifact `PitchKind-v2.2.15-debug` (ID `10709948783`). Mike's screenshot shows a downloaded APK checksum, but this pass has not directly inspected packaged contents or run installed-device acceptance. Do not infer DEPLOYED/LIVE from CI success. |
| PitchKind Android v2.2.16 source | **WRITTEN; CI/artifact/device verification not established here** | GitHub main source commit `6389136442bb443aa47527937daa1f04578ac58b` sets versionCode 2216/versionName 2.2.16 and adds further-fixture cards, club/team detail and kit-profile overrides, kit-clash warnings and role-sensitive match programme presentation. A verifier script and APK workflow were updated in source; neither their execution nor a v2.2.16 artifact has been verified in this review. |
| v2.2.13 Undo match played | **BUILT / TESTED on Mike's device** | The 2026-09-22 handoff entry records a successful installed-device reversal of the accidental Junior Reds result, return to Scheduled, fixture reappearance and removal from active stats. Its `notify_match_reopened` RPC was reported deployed and permission-checked separately. |
| Club creation/self-service onboarding | **ON HOLD by Mike** | Shooters Hill is the active pilot only. Do not resume multi-club rollout or club-creation feature work without explicit re-authorisation and a source-of-truth check. Existing code is not deleted by this decision. |
| Public club-logo catalogue | **PLANNED** | Use canonical club ID within the existing directory; do not create a competing club database. |
| U15 reusable player-code backend | **WRITTEN / NOT DEPLOYED** | Migration/Edge Function source does not establish end-to-end live player access. |
| GitHub-root `ARCHITECTURE.md` | **ABSENT at this check** | GitHub contents API returned 404 on main. Drive current master is present; the root mirror requires a verified commit/push. |

The v2.2.12 multi-week implementation was initially blocked by stale CI assertions; commit `b0d056e326314956cd393202e5eede8ddd9cbe75` corrected those gates, and the subsequent v2.2.12 build succeeded. v2.2.13 adds Undo match played; v2.2.14 makes dark mode the default and improves match overview/kit/venue controls; v2.2.15 exposes fixture details before Match played, map previews, home/away-relative scoring and guarded manual-match removal. v2.2.16 source adds extended fixture cards, private club-side kit-profile corrections and a role-sensitive match programme. These are source/CI observations where specified, not blanket installed-device acceptance for v2.2.14–16.

---

# 2. Single Source-of-Truth Register

There must be only one intended authority per category. A migration fallback may
exist temporarily, but it must not silently overwrite the intended authority.

## 2.1 Public Selkent club directory and division membership

Intended authoritative path:

```text
Selkent
  ↓
scripts/scrape_directory.py
  ↓
data/directory.json
```

Coverage:

- all discovered Selkent age groups;
- club directory;
- division/team membership;
- team-to-club links.

Update cadence: weekly.

Android integration of this authority is **BUILT** in v2.2.2, but
**DEPLOYED-LIVE is not verified** as of 2026-09-19.

## 2.2 U12+ league standings

Intended authoritative path:

```text
Selkent /public/resultsTable/{division_id}
  ↓
scripts/selkent_results.py
  ↓
scripts/scrape.py
  ↓
data/results.json
  ↓
Android app
```

Scope: U12+ only.

Android integration is **BUILT** in v2.2.2, but **DEPLOYED-LIVE is not verified**
as of 2026-09-19.

The Android app must not calculate an invented official position. Source
`row_order` may be displayed, but it is not an official position field.

## 2.3 Fixtures

Authoritative public feed path:

```text
Selkent fixturespage/{agegroup_id} week tabs
  -> fixturespage/{agegroup_id}/{week_id} for every advertised week
  -> scripts/scrape.py
  -> data/results.json
  -> Android static-feed adapter
```

Scope: all supported Selkent age groups. Provider `data-week-id` values are authoritative; do not calculate weeks by date or special-case U9. Merge/deduplicate fixture rows by stable provider identity, retaining a name fallback. Unknown populated markup or a failed advertised-week fetch must fail closed and preserve the previous published feed. Public U7–U11 fixture information is allowed, but public scores/results/tables remain prohibited by Section 7.

At the GitHub main feed refresh of 2026-09-22 18:05 UTC, schema-v2 `data/results.json` contains 1,160 fixtures across 15 age groups. U9 contains 44 fixtures across week IDs `[2,3]`, including the 2026-09-27 Junior Reds Sabres v Shooters Hill AFC Valiants and 2026-10-04 Shooters Hill AFC Valiants v Phoenix Sports Panthers rows. The fixture parser/feed is **TESTED**. The Android static fixture path passed the targeted v2.2.11 device check; v2.2.15 packaging/device behaviour is not independently accepted in this update. The temporary live Selkent fixture fallback remains isolated and cannot overwrite static directory/standings state.

---

## 2.4 Published match results

Intended final authority:

```text
Selkent → scripts/scrape.py → data/results.json
```

Scope: U12+ only.

Status: **PLANNED** for static cutover.

Age/division discovery and empty-result states have been tested; real populated
result-row markup still requires capture and verification. U7-U11 public results
must never be published.

## 2.5 Private club-entered results, player, roster and safeguarding data

Authoritative source:

```text
Supabase only
```

The backend contract was **DEPLOYED-LIVE** and verified on 2026-09-18 via the
live backend export.

GitHub static data must never contain:

- player rosters;
- parent/player links;
- emergency contacts;
- medical information or allergies;
- private attendance;
- safeguarding concerns or exports;
- private coach notes;
- private U7-U11 results.

## 2.6 Dormant/legacy Selkent systems

Older Supabase Selkent ingestion and legacy Android live acquisition may exist as
migration/reference systems. They are not allowed to become a competing
production authority without revising this document first.

---

## 2.7 App-wide UI design system

Authoritative UI standard:

```text
APP-UI-DESIGN-GUIDELINES.md
```

Governing version: **1.4**.

Cross-platform extension:

```text
BRAND-GUIDELINES.md
```

`BRAND-GUIDELINES.md` extends the app guidelines and does not compete with them. On anything the app shows, `APP-UI-DESIGN-GUIDELINES.md` wins.

Historical build snapshot from 2026-09-21 (the newer source/CI and device status is in Section 1):

```text
visible PitchKind identity: AUTHORISED by Mike
v2.2.11 source against v1.4 checks: TESTED
v2.2.11 APK: BUILT
installed-device/runtime acceptance: subsequently TESTED for targeted flows, as recorded in Section 1
DEPLOYED-LIVE: NOT CLAIMED
```

Rules:

- the green/white design family is mandatory throughout the product;
- the official visible product identity is PitchKind: the approved P monogram and PitchKind wordmark lock-up with tagline `ORGANISE | CONNECT | PLAY`;
- the Grassroots Club Hub grass-O identity, its old tagline and the handwritten "More Than A Game" accent are retired;
- product branding owns launcher/PWA icon, splash, authentication, club-creation onboarding, Settings/About and neutral fallback states;
- a selected club's verified badge remains the identity on club/team-specific surfaces; the PitchKind mark is used there only when the club badge is missing/unverified;
- club configuration must never overwrite launcher, splash or authentication product identity;
- internal identifiers containing the old name remain unchanged until separately authorised; visible branding authorisation does not authorise an applicationId, deep-link, bridge, feed/repository, localStorage, PIN-format or database rename;
- realistic generated/licensed raster football imagery is required for footballs, goals, pitches, players and team scenes; CSS/SVG may not be used to construct fake photographic football/goal/pitch imagery;
- SVG remains allowed for interface icons and approved branding marks;
- layouts must adapt across small phones, standard/large phones, foldables/tablets and landscape without clipping, hidden information, compressed controls or awkward crowding;
- short screens scroll rather than shrinking buttons, fields or readable text below the standard;
- hero source imagery must be at least 1600 px wide (1920+ preferred) and must not be visibly blurred, stretched or over-compressed;
- Android `WindowInsets` must be converted from physical pixels to CSS px before WebView layout use and must be applied once, not stacked across shell/header layers;
- no design deviation or exception is authorised unless Mike explicitly approves it, with the decision recorded by a new `LOG-ENTRY_...` file in `97 - LOG INBOX` and in this architecture when architectural scope changes.

The canonical text documents live in the shared Drive current-master folder. Source snapshots are provenance copies only.

## 2.8 Club logos and automatic club branding

Decision confirmed 2026-09-19.

Club logos are a new public data type, but they must **not** create a second or competing
club database. Club identity remains governed by the existing canonical club directory
and canonical club ID.

Intended authoritative path:

```text
league/provider club source
  ↓
canonical club directory / canonical club_id
  ↓
logo metadata attached to that club record
  ↓
public logo asset storage/CDN
  ↓
app auto-population after club selection
```

Initial scope: every club already represented in the canonical Selkent directory. As
the supported league/club directory expands, logo coverage expands through the same
club identity model rather than through a separate national logo directory.

Minimum logo metadata:

```text
club_id
logo_url
logo_status
logo_source
logo_updated_at
```

Allowed status values should distinguish at least:

```text
verified
club_uploaded
unverified
missing
deprecated
```

Rules:

- canonical `club_id` is the lookup key; club name must never be used as the identity key;
- actual image bytes live in a dedicated public asset store/CDN rather than being embedded
  in `data/directory.json`;
- `data/directory.json` may carry the logo metadata/reference needed by the app;
- selecting a club should resolve its logo automatically and reuse it consistently across
  the club header, dashboard, team pages, fixtures/results, tables and other appropriate
  club-branded surfaces;
- where no verified logo exists, the app must show the neutral PitchKind product mark
  rather than guess a badge;
- a club-admin replacement/upload path should allow an incorrect or outdated badge to be
  corrected without changing canonical club identity;
- logo provenance must be retained so club-supplied/approved artwork can be distinguished
  from externally discovered artwork;
- logo collection must respect branding/copyright permissions and must not treat an
  arbitrary web image as verified merely because it matches a club name.

Status on 2026-09-19:

```text
architecture decision: RECORDED
product-brand/missing-badge fallback path: BUILT in the inspected v2.2.11 APK
logo catalogue: PLANNED
app auto-population from the future verified logo catalogue: PLANNED
installed-device verification of fallback behaviour: NOT TESTED for v2.2.11
DEPLOYED-LIVE: not claimed
```

---

# 3. Selkent standings contract

Verified endpoint:

```text
/public/resultsTable/{division_id}
```

Verified columns:

```text
Team
Played
Won
Drawn
Lost
GF
GA
Points
```

Rows may preserve:

- `row_order`;
- `provider_team_id`;
- provider division ID;
- team name;
- played/won/drawn/lost/GF/GA/points;
- update/disclaimer text where available.

`row_order` is not an official `position`. Do not invent tiebreak rules or goal
difference ordering.

Synthetic non-zero parser tests are **TESTED**. Real non-zero table spot-checking
remains **PLANNED** when a real non-zero source appears.

---

# 4. Identity rules

Canonical Selkent club identity comes from `/public/clubs/{id}`.

A results-table `data-team-id` is a provider team ID, not a club ID, and may vary
across age groups/divisions. It must not replace canonical club identity.

For private `public.teams`, one logical team for one season is:

```text
club_id + season + age_group + normalized team display name
```

`selkent_label` is mutable import/display metadata, not a stable identity key.

The duplicate-team repair recorded on 2026-09-19 is **DEPLOYED-LIVE** only to the
extent demonstrated by the live database evidence for that migration. Any future
claim about its continuing state must be rechecked against the database.

---

# 5. Update frequencies

| Data type | Intended frequency |
|---|---|
| Club/team directory | Weekly |
| Club logo metadata/assets | Weekly reconciliation; immediate on verified club-admin replacement |
| Fixtures | Every six hours (current public-feed workflow) |
| Published U12+ results | Every six hours when provider-verified parsing is available; static result cutover remains PLANNED |
| U12+ standings | Every six hours (current public-feed workflow) |
| Private club-entered results | Immediate user action |
| Player/safeguarding data | Immediate user action |

The documented Selkent GitHub workflow is intended to execute parser tests before
publication and prefer stale known-good data over corrupt replacement data.

---

# 6. Publication safety

For public static feeds:

- collect before publishing;
- publish atomically;
- fail closed on unverified populated provider markup;
- preserve the existing known-good file if collection/parsing fails;
- never merge private Supabase data into public JSON.

For `data/directory.json`, a failed required scrape must not replace the known-good
directory.

---

# 7. U7-U11 public-result boundary

PitchKind architecture requires:

```text
public Selkent results/standings: U12+
private club-entered results: U7-U11 allowed only inside authenticated club scope
```

Private younger-age results must never appear in public JSON or unauthenticated
views.

Safeguarding data remains Supabase-only and access-controlled.

---

# 8. Synthetic/test data

Synthetic fixtures must:

- start with `SYNTHETIC_`;
- contain `SYNTHETIC TEST FIXTURE — NOT REAL SELKENT DATA`;
- use obviously fictional names/IDs;
- state whether the markup is verified or inferred.

Synthetic parser success is **TESTED** evidence only and must not be described as
production verification.

---

# 9. Android integration

Final intended flow:

```text
Selkent
   ↓
GitHub Actions
   ↓
validated static JSON
   ↓
Android app
```

Static host/repository/paths implemented in the BUILT v2.2.2 APK:

```text
https://raw.githubusercontent.com/
michaeljbriggs86-ctrl/Grassroots-Club-Hub
/main/data/directory.json
/main/data/results.json
```

Native access in that build is constrained to HTTPS, the exact host/repository/path,
GET-only static feed requests, and redirect revalidation.

**Security-review status — checked 2026-09-19:** evidence that a separate deliberate
native-bridge security review was completed has **not been verified**. The presence
of the allowlist in source or a BUILT APK proves implementation, not security
approval. Do not describe this allowlist as "approved" until that review evidence
is produced or Mike explicitly records the decision after review.

## 9.1 Directory

Status on 2026-09-19:

```text
BUILT
DEPLOYED-LIVE: NOT VERIFIED
```

Evidence: inspected v2.2.2 APK contains `assets/static-feed-overlay.js`, the
`index.html` reference, the exact raw GitHub paths and the 2.2.2 native marker.

## 9.2 Standings

Status on 2026-09-19:

```text
BUILT
DEPLOYED-LIVE: NOT VERIFIED
```

Same inspected v2.2.2 APK evidence applies.

## 9.3 Fixtures

The Android app-facing public-fixture authority is the schema-v2 static `data/results.json` feed for all supported ages. Next Match selects the nearest future fixture; the Fixtures list must expose all available future team fixtures without the old eleven-row cap. The v2.2.12 source implements provider week discovery and an uncapped list. The published feed on 2026-09-22 contains 15 age groups, 1,160 fixture rows, and U9 weeks `[2,3]` (44 rows).

Targeted v2.2.11 device acceptance for Next Match passed. v2.2.15 source/CI changes add visible fixture identity and map previews; v2.2.16 source presents further fixtures as full cards with venue/maps and coach-only Match played actions. Installed-device acceptance of these later changes is not verified here. The live Selkent path is a temporary isolated fallback, never a second source of truth for directory or standings.

v2.2.16 source also stores manual home/away kit profiles under the club's `state.selkent.kitProfiles`, keyed by normalized team name, with Club Admin-only editing and coach/admin kit-clash warnings. These corrections are club-side display overrides, not changes to the public Selkent feed or a new canonical club-logo database. The programme source renders Played/Not played for cloud-mode parents while exposing home/away scores to permitted staff. Preserve the U7–U11 restriction in Section 7 at every data-access and rendering boundary; source-level role checks alone do not establish end-to-end privacy or installed-device acceptance.

---

## 9.4 Published results

Status on 2026-09-19:

```text
PLANNED static cutover
```

The built 2.2.2 app intentionally retains the live published-results fallback
until real populated U12+ markup is verified.

## 9.5 No dual-authority overwrite

Static directory/standings state must not later be overwritten by legacy live
Android polling. Temporary fixture/result fallbacks must remain isolated.

---

## 9.6 Login and account-entry model

Product direction confirmed 2026-09-19 and represented in v2.2.4 source:

- Club admins, coaches and parents use one common opening login screen with email + password and are redirected according to their authenticated role/context.
- A separate **Player Login** path is restricted to eligible U15 player accounts. It uses the player's existing name plus a reusable code generated by the club/coach; no player email address or phone credential is required by that login flow.
- Player-code validation and account/session creation remain private Supabase concerns; codes and player identity data must not be placed in the public GitHub static feeds.
- The separate **Club Sign Up** route remains available from the opening screen.
- Mike clarified on 2026-09-19 that the approved login mock-up is the **UI acceptance target**, not merely a theme reference. The app must reproduce the visible hierarchy and visual system shown there unless a new design is explicitly approved.
- The normal adult opening screen therefore contains only the approved primary elements: branding/hero, Welcome Back copy, email, password, Forgot password, Log In, Player Login, Club Sign Up, routing explanation and grass footer. Migration-only PIN/invite/setup controls must not visually compete on that default screen.
- Authentication screens inherit the governing app-wide UI standard in `APP-UI-DESIGN-GUIDELINES.md`; login is no longer a separate visual island.
- v2.2.6 uses generated photographic raster hero imagery at 2048×740, removes duplicate slogan overlays, and corrects high-density Android safe-area handling by converting physical `WindowInsets` to CSS px before WebView layout.
- The authentication top inset is applied exactly once at the brand/header region; the auth shell does not reapply it.
- Source carries design revision marker `approved-app-ui-2026-09-19-v1.1-responsive-imagery` so future regression tests can detect silent visual drift.

Status on 2026-09-19:

 ```text
v2.2.4 login UI/source: WRITTEN + TESTED (source)
reusable U15 player-code backend: WRITTEN / NOT DEPLOYED
v2.2.4 APK: BUILT — artifact inspected 2026-09-19
DEPLOYED-LIVE: NOT VERIFIED / not claimed
```

The U15-only restriction remains the governing product/legal decision. This work
changes the authentication mechanism for eligible players; it does not expand player
access to younger age groups.

---

## 9.7 App-wide UI implementation

Direction explicitly locked by Mike: `APP-UI-DESIGN-GUIDELINES.md` is the exact visual basis for the app. The governing revision is **v1.4**.

Mike authorised the visible PitchKind identity implementation on 2026-09-21. That authorisation covers the name, approved monogram/wordmark/icon assets and interface branding. It does **not** authorise broad internal identifier renames, and trade-mark clearance remains incomplete.

Historical v2.2.11 implementation evidence (current release/CI status is in Sections 1 and 10):

```text
v2.2.11 source: TESTED (63/63 verifier checks)
v2.2.11 APK: BUILT
targeted device checks: subsequently TESTED by Mike, as recorded in Section 1
DEPLOYED-LIVE: NOT CLAIMED
```

v2.2.11 preserves the v1.4 design marker and approved PitchKind asset hashes, keeps the single app-wide design layer, carries the PitchKind title/launcher/brand surfaces, and includes the full-screen Match played presentation added in this corrective build.

Artifact evidence:
- commit `5045289a5bcc8ca42af2ea73df1e237782e79c93`;
- GitHub Actions run `35648644000`: SUCCESS;
- permanent signer certificate SHA-256 `72baee06cccf6583506887867b14a07126baf7c44d5dabd3135144f123df0bda`;
- inspected APK SHA-256 `87575c77a769504b5c627fc3c928060b6eae5e0c29de5b0275290b8c899032bc`.

Historical v2.2.6/v2.2.7 source descriptions remain provenance only; they do not override the current v1.4 governing standard or the later release evidence in Sections 1 and 10.

# 10. Build and release pipeline state - checked 2026-09-22

Exactly one live YAML workflow produces shippable Android APKs: `.github/workflows/build-apk.yml`. Other workflows refresh Selkent data or run parser checks. The scraper's public-feed refresh schedule is six-hourly.

| Release | Source commit | Actions evidence | Runtime boundary |
|---|---|---|---|
| v2.2.12 | `b0d056e326314956cd393202e5eede8ddd9cbe75` | Run `35694257790` SUCCESS after CI gate correction | No general installed-device claim |
| v2.2.13 | `14e13c6eab1d589bac0a6800f19ce29c46bbfd59` | Run `35751001335` SUCCESS; inspected APK/checksums recorded in handoff | Undo match played tested successfully on Mike's device |
| v2.2.14 | `748aa19e3d05ebdfd27cff6c47b7951059c5f88d` | Run `35754337135` SUCCESS | Installed-device acceptance not established here |
| v2.2.15 | `b42911e566b257ccde2da9d7298a6df75eacdba8` | Run `35761515223` SUCCESS; artifact ID `10709948783`, archive SHA-256 `4875800cd5bf9d61e433cb142d9bf204fa2f557df147abb0abeda14271ea3fda` | Artifact contents not directly inspected in this update; installed-device acceptance not established |
| v2.2.16 | `6389136442bb443aa47527937daa1f04578ac58b` | Workflow and verifier updated in source; no successful run or APK inspected in this review | WRITTEN only; no BUILT or installed-device claim |

A successful workflow and artifact listing do not alone justify a **BUILT** or **DEPLOYED/LIVE** claim under the collaboration protocol. The signed APK and its actual contents must be inspected before asserting BUILT for v2.2.15 or v2.2.16; device behaviour must be tested separately. The GitHub feed-only commit `206c82f597f3fd0c081c2a1652dc4df36b31b601` followed v2.2.15 and preceded the v2.2.16 source commit; it is not an Android source release.

The non-workflow archive `.github/workflows/chatgpt-action-main.zip` remains a repository-hygiene review item, not a competing APK workflow.

---

# 11. Known open items

Club creation/self-service onboarding and external-club rollout are **ON HOLD** by Mike; Shooters Hill is the active pilot. Existing Selkent directory coverage does not authorise expanded onboarding work.

0. **PLANNED** - deploy and verify the reusable U15 player-code Supabase migration/Edge Function before treating name + reusable-code login as end-to-end functional.
1. **TESTED v2.2.11 targeted device acceptance / PLANNED v2.2.15–16 acceptance** - Mike confirmed Inbox, Next Match, Match played and Scheduled Add Match in v2.2.11. Independently inspect later APK contents and test fixture overview/cards, map previews, home/away scoring, kit corrections and clash warnings, parent privacy and guarded manual-match deletion on-device before claiming those behaviours BUILT or LIVE.
2. **PLANNED** - capture and verify real populated U12+ published-result rows before static published-results cutover.
3. **PLANNED** - independently spot-check a real non-zero standings table against the provider when the comparison evidence is available.
4. **PLANNED** - complete the separate defence-in-depth review of backend access surfaces already identified in security notes.
5. **PLANNED** - remove the dead legacy `activateAssignment()` activation path, obsolete activation-gate UI and unused native sign/verify assignment stubs; only graduate the cleanup to BUILT after inspecting a rebuilt APK.
6. **PLANNED** - add the verified U8/U9 `divisionsspage` captures from Drive into `tests/fixtures/`; they are not present in the current repository fixture folder.
7. **PLANNED** - re-fetch and verify U10X/U12/U14/Senior `divisionsspage` payloads; current shared evidence does not establish all four as repository fixtures.
8. **PLANNED GitHub mirror** - the Drive master was promoted in place and updated to this 2026-09-22 status. Restore GitHub-root `ARCHITECTURE.md` from these bytes via the guarded Termux script; verify the remote commit and content checksum. GitHub root returned 404 at this check.
9. **PLANNED** - remove duplicate repo files `scripts/scrape (1).py` and `tests/test_selkent_scrape (1).py` after confirming no workflow depends on them.
10. **PLANNED security hardening** - review current Supabase advisor findings and preserve evidence for each finding resolved or accepted; advisor counts are review targets, not automatically confirmed exploits.
11. **PLANNED** - build the canonical club-logo catalogue for clubs already in the supported directory, retain provenance, add public logo metadata, implement club-selection auto-population and provide the verified club-admin correction path.
12. **PLANNED repository hygiene** - review and relocate/remove `.github/workflows/chatgpt-action-main.zip` if it has no current provenance purpose; it is not an executable workflow.
13. **PLANNED documentation reconciliation** - update `CURRENT-STATUS-MANIFEST.md` and status-only wording in the app/brand guidelines to align with the authorised PitchKind identity and v2.2.15 CI / v2.2.16 source evidence, without changing approved visual rules.

# 11. Legal/documentation working-copy decision

Checked 2026-09-19.

Mike explicitly confirmed on 2026-09-19 that restricted U15 player access is to
remain, because eligible U15 players need access for their own match arrangements,
provided the safeguarding and legal-compliance protections remain in place. This
also matches Mike's earlier explicit 2026-09-15 instruction that player access is
U15-only and must not be available to younger teams.

The Privacy Policy working copy has therefore been aligned to the decided product
behaviour and is currently titled:

`PLANNED - Privacy Policy Working Copy - U15 PLAYER ACCESS`

Its restricted U15 model includes no player inbox/messaging access and excludes
safeguarding information, medical/allergy information, private coach notes, parent
contact details and club-administration/compliance data.

Status:

```text
PLANNED — product/policy direction decided; legal publication/deployment not verified
```

This resolves the former product-policy conflict. It does **not** make the Privacy
Policy or DPA final legal documents. Both remain working copies until placeholders,
legal/commercial details and any required review are completed.

`PLANNED - Data Processing Agreement Working Copy` remains a working draft and
must not be represented as a final/deployed agreement.

---

# 12. Architectural principles

1. One intended authority per data category.
2. Public Selkent data may live in static GitHub JSON.
3. Private club/player/safeguarding data stays in Supabase.
4. U7-U11 public results/standings remain excluded.
5. Do not invent provider identifiers.
6. Do not invent league positions or tiebreak rules.
7. Dynamic provider discovery is preferred to hardcoded age IDs.
8. Synthetic data must remain unmistakably synthetic.
9. Failed scrapes must not destroy known-good public data.
10. GitHub, Supabase and Android must not become silent competing authorities.
11. Do not remove a migration fallback until replacement coverage is verified.
12. Status claims must follow `AI-COLLABORATION-PROTOCOL.md` and be dated.
13. Source code must remain readable source code; do not embed source as base64 in
    CI/workflow files.
14. Inspect the actual artifact before claiming BUILT or DEPLOYED-LIVE.

---

# Changelog

## 2026-09-22 - v2.2.16 source reconciliation

GitHub main advanced to v2.2.16 commit `6389136442bb443aa47527937daa1f04578ac58b` before the guarded GitHub-root mirror could be pushed. Recorded the new fixture-card, kit-profile, clash-warning and role-sensitive programme source without assuming a successful CI run, inspected APK or installed-device acceptance. The static feed, private club data authority, U7–U11 privacy boundary and Shooters Hill-only pilot hold are unchanged. GitHub-root mirror is still pending a verified Termux commit and content check.

## 2026-09-22 - v2.2.15 evidence and multi-week fixture reconciliation

Corrected candidate-state wording after Drive promotion; recorded v2.2.12–15 source commits and CI boundaries, verified the latest static fixture feed counts/age coverage, marked the v2.2.13 device-tested undo flow, and recorded Mike's Shooters Hill-only pilot/club-creation hold. GitHub-root mirror remains pending until a Termux push is verified. No new data-source authority or public-result permission was introduced.


## 2026-09-21 - Reconciled fixture authority, v2.2.11 build evidence and release pipeline

Updated the current evidence/status register from verified 2026-09-21 artifacts. Real populated Selkent fixture rows and the production U9 static feed are now TESTED; static fixture integration is BUILT in the inspected v2.2.11 APK, while installed-device runtime acceptance remains NOT TESTED. Recorded the successful single APK-producing workflow, v2.2.11 commit/run/artifact/signer evidence, Mike's authorisation of the visible PitchKind identity, and the fact that broad internal identifier renames and trade-mark clearance remain outside that authorisation. Updated stale fixture, UI, release-pipeline and open-item wording. Public/private data boundaries and age restrictions are unchanged.

## 2026-09-19 — v2.2.6 responsive/imagery correction

Installed-device review showed that v2.2.5 still violated the governing UI standard: a large blank region appeared above the brand on a high-density Android device, the hero image was visibly blurred/compressed, and the layout did not adapt cleanly enough across screen sizes.

Root-cause inspection found that Android `WindowInsets` were physical pixels but were passed directly into CSS and could be applied more than once. v2.2.6 converts the values by display density, limits defensive inset values, and applies the auth top inset once at the brand header. Active generated hero assets were replaced with 2048×740 high-quality JPEGs, duplicate slogan overlay was removed, the second photographic auth footer was removed, and explicit foldable/tablet/landscape layouts were added.

`APP-UI-DESIGN-GUIDELINES.md` is advanced to version 1.1. Source verification passes 42/42 checks plus JS/CSS checks. Status remains **WRITTEN + TESTED at source level** until the exact APK is built and inspected.

Source ZIP SHA-256: `001350591a6ad88bd71a42db60bf03ae259f55a4e7c92e123624c33aff5f0e85`. Guideline SHA-256: `60d5bb37b470f172dd4d3874b8bb1d3263d98cccb2ab8bd56194a07d322a8c37`.

## 2026-09-19 — Club-logo auto-population architecture

Mike confirmed that selecting a club should automatically populate that club's badge
throughout the app. Architecture review found no existing logo source-of-truth category,
so logos are recorded as a new public data type while the existing canonical club
directory remains authoritative for identity.

Decision: key logo metadata by canonical `club_id`, store image bytes in a dedicated
public asset store/CDN, expose only the reference/provenance metadata needed by the
directory/app, use a neutral fallback where no verified badge exists, and provide a
verified club-admin replacement path. Initial population scope is every club currently
in the canonical Selkent directory; future league expansion inherits the same model.

Status: **PLANNED**. No logo catalogue, app integration, BUILT artifact or DEPLOYED-LIVE
state is claimed by this architecture update.

## 2026-09-19 — App-wide UI standard locked / v2.2.5 source

Mike explicitly designated the app-wide green/white, realistic-football, responsive design as the exact basis for Grassroots Club Hub moving forward: **no deviations and no exceptions unless explicitly discussed and agreed**.

Added `APP-UI-DESIGN-GUIDELINES.md` as the UI source of truth. v2.2.5 source applies the shared system across login, onboarding and authenticated surfaces; replaces constructed auth football/goal SVG scenes with generated photographic raster assets; and adds responsive rules so short/small screens scroll/reflow rather than clipping or crushing content. Source verification: 31/31 checks plus JavaScript syntax and CSS structural checks. APK status remains unverified until an actual v2.2.5 artifact is built and inspected.

Canonical v2.2.5 source ZIP SHA-256: `3534ba405b7d8982c4b25eacc09edc6124b28afcce5d76b7f7ce81c60d32562d`. Canonical UI guideline SHA-256: `b5adeb8516b923d91259b30b7e31769bf8570c022f4f3cbde5ead53239026d43`.

## 2026-09-19 — v2.2.4 mock-up-exact UI acceptance and build

Recorded Mike's clarification that the approved login mock-up is the implemented UI
acceptance target, not just a design-theme reference. Source verification passed
23/23 structural UI checks plus JavaScript/CSS checks. Design marker:
`approved-mockup-2026-09-19-v1`.

The exact canonical v2.2.4 source was then built by GitHub run `35454187954`.
Direct APK inspection verified the 2.2.4 compiled marker, approved mock-up marker
and static-feed overlay. APK SHA-256:
`14b4abd74c94b6902fabedaed84f2a647b83824d11753554abf21c16b55f7f44`.

Status: **BUILT**. **DEPLOYED-LIVE remains NOT VERIFIED**. Build evidence:
`BUILD-VERIFICATION-v2.2.4.md`.

The candidate readable release workflow also compiles v2.2.4 successfully but its
verification gate currently fails because it checks only `classes.dex` while the
marker is in `classes2.dex`. The duplicate legacy workflow still needs retirement.

## 2026-09-19 — v2.2.3 login refresh

Recorded the approved login redesign as **WRITTEN + TESTED at source level**. The
opening screen is now specified as one adult email/password login for admins, coaches
and parents, plus separate Player Login and Club Sign Up routes. The approved
green/white football mock-up is bundled as the active visual specification.

Recorded the U15 player authentication change: eligible players use their existing
player name plus a reusable club/coach-generated code and do not require a player
email address or phone credential for this flow. The U15-only access boundary is
unchanged.

The reusable player-code backend source is **WRITTEN / NOT DEPLOYED** and v2.2.3
has no inspected APK yet, so it is not BUILT and no DEPLOYED-LIVE claim is made.

## 2026-09-19 — U15 decision and release-pipeline remediation

Recorded Mike's explicit decision to retain restricted U15 player access and align
the Privacy Policy working copy to that product behaviour. The legal documents
remain PLANNED working copies, not DEPLOYED-LIVE.

Recorded the chosen APK release remediation: retire/delete `build-apk.yml`, keep
one APK-producing workflow, replace the base64 patcher with the readable source
workflow, and require artifact verification. Repository mutation remains PLANNED
because the attempted workflow-file change was rejected by GitHub integration
permissions.

Recorded removal of the dead legacy `activateAssignment()` path as PLANNED until
a rebuilt APK verifies the cleanup.

## 2026-09-19 — Protocol reconciliation

Applied `AI-COLLABORATION-PROTOCOL.md` to the governing architecture.

Corrected the Android static-feed claim from an undifferentiated
“authoritative/live” state to:

```text
directory: BUILT; DEPLOYED-LIVE not verified
standings: BUILT; DEPLOYED-LIVE not verified
fixtures static cutover: PLANNED
published-results static cutover: PLANNED
```

Recorded artifact hashes and the 2.2.1/2.2.2 build-pipeline split.

The earlier `TODO-SYNC-INTEGRATION.md` planning document is superseded and must not
be used as current status.

## 2026-09-19 — v2.2.7 product brand-system integration

The governing UI standard advances to version 1.2 with marker `approved-app-ui-2026-09-19-v1.2-brand-system`. The approved Grassroots Club Hub identity uses the grass-style O and exact tagline `CONNECT • ORGANISE • GROW THE GAME`.

v2.2.7 separates platform identity from club identity: product branding owns launcher/PWA icon, splash, authentication, club-creation onboarding, Settings/About and neutral fallback states; verified club badges remain authoritative on signed-in club/team surfaces. The source also removes generated-initials badge fallback and prevents club configuration from mutating the product splash.

Source verification: **65/65 brand-system checks** plus JavaScript syntax checks. v2.2.7 remains **NOT BUILT / NOT INSPECTED** until an APK from the exact source archive is produced and directly inspected. No league, age-group, parser, backend or public-data source-of-truth scope changes were introduced.
