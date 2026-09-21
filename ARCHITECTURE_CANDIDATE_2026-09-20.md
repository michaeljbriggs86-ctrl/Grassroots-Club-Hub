# PitchKind - Data Architecture Reference

**Document state:** Current governing architecture reference  
**Last updated:** 2026-09-20  
**Collaboration rules:** `AI-COLLABORATION-PROTOCOL.md`  
**Product name:** PitchKind (formerly Grassroots Club Hub), per Mike's decision of 2026-09-20 (AI-HANDOFF-LOG.md entries 16 and 17). The governing UI standard is APP-UI-DESIGN-GUIDELINES.md v1.4. Code identifiers, file names, repository names and artifact names that contain the old name are unchanged until Mike authorises the rename implementation. Trade-mark clearance for the new name is NOT completed.

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

# 1. Current evidence-backed status — checked 2026-09-19

| Area | Status | Evidence / boundary |
|---|---|---|
| Static Android directory integration | **BUILT** | APK `Grassroots-Club-Hub-v2.2.2-static-feed.apk` inspected 2026-09-19; `assets/static-feed-overlay.js` present and referenced by `index.html`. |
| Static Android standings integration | **BUILT** | Same inspected 2.2.2 APK; overlay uses schema-v2 `data/results.json`. |
| Static Android directory/standings cutover | **DEPLOYED-LIVE: NOT VERIFIED** | The previously downloaded/shipping `Grassroots-Club-Hub-APK (11).zip` is 2.2.1 and does not contain the overlay. Do not claim cutover until the actual distributed/installed APK is verified. |
| Static fixtures cutover | **PLANNED** | Built 2.2.2 retains the temporary live Selkent fixture fallback because populated provider fixture markup has not yet been verified. |
| Static published-results cutover | **PLANNED** | Built 2.2.2 retains the temporary live Selkent result fallback because populated provider result markup has not yet been verified. |
| Public static feed parser/generalisation | **TESTED** | Production-run evidence dated 2026-09-19 recorded 15 age groups, 54 standings divisions, 320 rows and 20/20 tests; current GitHub availability was not independently re-verified during this protocol pass. |
| Public club-logo auto-population | **PLANNED** | Architecture decision recorded 2026-09-19. Logo metadata will extend the canonical club directory and resolve by canonical club ID; no logo catalogue/app integration is yet claimed BUILT or DEPLOYED-LIVE. |
| Private Supabase backend contract | **DEPLOYED-LIVE** | Verified by `LIVE_BACKEND_EXPORT_Shooters_Hill_Team_Tracker_2026-09-18`, captured directly from the live project on 2026-09-18. |
| v2.2.6 responsive/imagery UI correction | **WRITTEN + TESTED (source)** | 42/42 source checks; physical→CSS inset conversion; 2048×740 generated hero assets; v1.1 design marker. APK not yet inspected. |
| v2.2.4 mock-up-exact login/auth UI | **BUILT** | Source ZIP passed 23/23 structural UI checks and syntax checks. APK produced from the exact source ZIP and directly inspected 2026-09-19; native 2.2.4 marker, approved mock-up revision and static-feed overlay are present. DEPLOYED-LIVE remains NOT VERIFIED. |
| Reusable U15 player-code backend | **WRITTEN / NOT DEPLOYED** | Migration + Edge Function source bundled under `pending_backend_not_deployed/`; end-to-end player name + reusable code login is not live until deployed and verified. |
| Legacy backend files in the Android source archive | **WRITTEN** historical reference | They are not the canonical live backend and must not be redeployed as current state. |

Artifact fingerprints used for the Android check:

```text
Grassroots-Club-Hub-APK (11).zip SHA-256
1e4bf9565683c9f7edf9be6afdb1719a8fcd83c84190381c62bc53e95adeda5d

APK (11) inner APK SHA-256
b18199a2fb9de325d3353254fbacdeb07faaa973920c31be244300937c88455f

v2.2.2 static-feed APK SHA-256
c38dea003e8f5f2342188fd5afa806b744cdf9a3275a2788aa4db09d5d84e246

v2.2.4 mock-up-exact APK SHA-256
14b4abd74c94b6902fabedaed84f2a647b83824d11753554abf21c16b55f7f44
```

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

Intended final authority:

```text
Selkent → scripts/scrape.py → data/results.json
```

Scope: all ages.

Status: **PLANNED** for static cutover.

The empty provider fixture shape has been tested, but populated fixture markup  
has not yet been verified. Therefore the 2.2.2 Android build retains a temporary  
live Selkent fixture fallback. It must remain isolated from static standings and  
directory state.

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

Status: the governing UI standard is version **1.4** (as of 2026-09-20). The v2.2.7 source implements version 1.2 and is **WRITTEN + TESTED at source level** (2026-09-19). Version 1.4 is NOT implemented in any build, and the rename implementation is not authorised yet.

This is the single source of truth for visual design, responsive layout, typography, imagery, spacing, UI components and screen consistency across the whole app. It applies to all roles, all current screens and all future screens.

Rules:

- the green/white design family is mandatory throughout the product;
- the official product identity is PitchKind (formerly Grassroots Club Hub): the P monogram and PitchKind wordmark lock-up with the tagline `ORGANISE | CONNECT | PLAY`, per APP-UI-DESIGN-GUIDELINES.md v1.4 section 4.1. The Grassroots Club Hub grass-O identity, its tagline and the handwritten "More Than A Game" accent are RETIRED (v1.4 sections 4.1 and 4.2). Builds up to v2.2.7 still carry the retired identity until the rename implementation is authorised. Trade-mark clearance is NOT completed;
- product branding owns launcher/PWA icon, splash, authentication, club-creation onboarding, Settings/About and neutral fallback states;
- a selected club's verified badge remains the identity on club/team-specific surfaces; the product mark is used there only when the club badge is missing/unverified;
- club configuration must never overwrite launcher, splash or authentication product identity;
- realistic generated/licensed raster football imagery is required for footballs, goals, pitches, players and team scenes; CSS/SVG may not be used to construct fake football/goal/pitch imagery;
- SVG remains allowed for interface icons and official branding marks;
- layouts must adapt across small phones, standard/large phones, foldables/tablets and landscape without clipping, hidden information, compressed controls or awkward crowding;
- short screens scroll rather than shrinking buttons, fields or readable text below the standard;
- hero source imagery must be at least 1600 px wide (1920+ preferred) and must not be visibly blurred, stretched or over-compressed;
- Android `WindowInsets` must be converted from physical pixels to CSS px before WebView layout use and must be applied once, not stacked across shell/header layers;
- authentication uses one deliberate hero image and a simple branded footer; no second blurred/decorative photo strip is permitted;
- no design deviation or exception is authorised unless Mike explicitly discusses and approves it, with the decision recorded by a new LOG-ENTRY file in 97 - LOG INBOX (compiled into AI-HANDOFF-LOG.md by the compiler) and in this architecture when architectural scope changes.

The canonical text document lives in the shared Drive current-master folder and is the governing machine-readable contract for ChatGPT, Claude and future contributors. Source archives carry only a dated snapshot for provenance.

Brand guidelines for platforms other than the app: BRAND-GUIDELINES.md (adopted 2026-09-20, version 1.0) covers name, logo, colour, typography, voice and imagery for the website, email, social media, store listings, documents and print, and holds the image generation framework. It is an extension of this UI standard and does not override it. Where the two differ on anything the app shows, APP-UI-DESIGN-GUIDELINES.md wins.

---

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
- where no verified logo exists, the app must show the neutral product placeholder (the PitchKind mark once the rename is implemented; the retired Grassroots Club Hub mark in existing builds) rather than guess a badge;
- a club-admin replacement/upload path should allow an incorrect or outdated badge to be  
  corrected without changing canonical club identity;
- logo provenance must be retained so club-supplied/approved artwork can be distinguished  
  from externally discovered artwork;
- logo collection must respect branding/copyright permissions and must not treat an  
  arbitrary web image as verified merely because it matches a club name.

Status on 2026-09-19:

```text
architecture decision: RECORDED
product-brand/missing-badge fallback path: WRITTEN + TESTED at source level in v2.2.7
logo catalogue: PLANNED
app auto-population from the future verified logo catalogue: PLANNED
BUILT APK for v2.2.7: not claimed
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
| Fixtures | Daily |
| Published U12+ results | Daily |
| U12+ standings | Daily |
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

Status on 2026-09-19:

```text
PLANNED static cutover
```

The built 2.2.2 app intentionally retains the live fixture fallback until real  
populated markup is verified.

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

Direction explicitly locked by Mike on 2026-09-19: the approved app-wide design references and `APP-UI-DESIGN-GUIDELINES.md` are the exact basis for the product moving forward. No deviations or exceptions are permitted unless explicitly discussed and agreed.

Governing revision as of 2026-09-20: **UI standard v1.4**. The v2.2.6 source below was implemented against v1.1 and its design marker still says v1.1.

Implemented in v2.2.6 source:

- `app-design-system.css` remains the final shared visual layer across login, onboarding and authenticated surfaces;
- generated football hero assets are 2048×740 JPEGs and replace the visibly blurred/compressed v2.2.5 assets;
- Android physical-pixel system insets are converted by display density before being exposed to CSS;
- the authentication safe-area top inset is applied once at the brand header, preventing the large blank gap observed on-device;
- duplicate handwritten hero text in DOM/CSS is removed; the generated hero carries the accent once (historical: the accent is RETIRED by v1.4 sections 4.1 and 4.2, and the existing hero assets must be regenerated without it when the identity is implemented);
- the second photographic auth footer strip is removed in favour of a simple branded footer;
- small phones scroll naturally with 54–56 px controls;
- 600–899 CSS px portrait foldables/tablets use a wider stacked layout;
- 900+ CSS px layouts use an intentional image/form split;
- short landscape screens use a dedicated split layout instead of compressing content;
- app-wide cards/forms/navigation/tables retain overflow, wrapping and minimum-width protections;
- design revision marker: `approved-app-ui-2026-09-19-v1.1-responsive-imagery`.

Status:

```text
v2.2.6 app-wide UI source: WRITTEN + TESTED (source)
v2.2.6 APK: NOT YET BUILT / NOT YET INSPECTED
DEPLOYED-LIVE: NOT CLAIMED
```

Source verification: **42/42 checks PASS**, plus JavaScript syntax and CSS structural checks.

Canonical v2.2.6 source ZIP SHA-256: `001350591a6ad88bd71a42db60bf03ae259f55a4e7c92e123624c33aff5f0e85`.  
Canonical UI guideline v1.1 SHA-256: `60d5bb37b470f172dd4d3874b8bb1d3263d98cccb2ab8bd56194a07d322a8c37`.

A v2.2.6 release workflow is **WRITTEN** as `build-apk-v2.2.6.yml`. It verifies the v1.1 design marker, density-normalised inset source, high-resolution generated imagery, source test suite and static feed before build, and performs a multidex-safe native-marker check across all `classes*.dex` files in the produced APK. It is not a live-repository/BUILT claim until the workflow is actually present/run and the resulting APK is inspected.

---

# 10. Build and release pipeline state — checked 2026-09-19

Two APK workflows were able to build on the same commit. This caused a real  
release-authority split.

Observed evidence:

```text
Legacy APK artifact downloaded as Grassroots-Club-Hub-APK (11).zip
→ inner app marker: GrassrootsClubHub/2.2.1
→ assets/static-feed-overlay.js: absent
→ index.html overlay reference: absent

Separate static-feed artifact
→ GrassrootsClubHub/2.2.2
→ assets/static-feed-overlay.js: present
→ index.html overlay reference: present
```

Therefore:

- the static-feed implementation is **BUILT**;
- the old 2.2.1 build is also **BUILT**;
- which build is **DEPLOYED-LIVE** is not verified here;
- no document may call directory/standings cutover live until the actual  
  distributed/installed artifact is inspected.

Release-pipeline consolidation is **PLANNED**. The chosen remediation, recorded  
2026-09-19, is to retire/delete `.github/workflows/build-apk.yml` so exactly one  
workflow can produce a shippable APK, replace the remaining base64 patch workflow  
with the readable source-build workflow already WRITTEN in the canonical handoff,  
and retain artifact verification before release.

A GitHub workflow-file mutation was attempted on 2026-09-19 but rejected with  
HTTP 403 `Resource not accessible by integration`. Therefore this remediation is  
a decided architecture change but remains **PLANNED / NOT VERIFIED** in the live  
repository.

**Live repository re-check — 2026-09-19:** the exact v2.2.4 source ZIP is on  
`main` and byte-identical to the canonical Drive source (Git blob SHA  
`c419d190882e3754aa004ea54523c92d2ed9daac`). Uploading it triggered both APK  
workflows on commit `c298f5da8755a1241e0c5626f225aa4d2220aa1f`, so split release  
authority remains active.

The live `.github/workflows/build-apk-static-feed.yml` is now readable,  
v2.2.4-aware and contains no base64-embedded source (blob  
`e15004f05d09c2600d35a2f6a133612f640e5c00`, 5,409 bytes). Run  
`35454187950` verified the source and completed the Android build, then failed  
only in its APK verification step because the script searches `classes.dex` for  
`GrassrootsClubHub/2.2.4` while the multidex APK places that marker in  
`classes2.dex`. The verifier must inspect all DEX files or another reliable APK  
metadata surface.

The parallel legacy `build-apk.yml` run `35454187954` succeeded and uploaded an  
APK from the same exact source. Direct inspection verified the 2.2.4 native marker,  
approved mock-up marker and static-feed overlay. APK SHA-256:  
`14b4abd74c94b6902fabedaed84f2a647b83824d11753554abf21c16b55f7f44`.  
The built APK still contains the obsolete `activateAssignment()` path.

Therefore v2.2.4 is **BUILT**. Release-pipeline consolidation and  
DEPLOYED-LIVE verification remain outstanding. The source ZIP also contains a stale  
historical `build-apk-static-feed.REPLACEMENT.yml` sidecar targeting v2.2.2/2202;  
remove or refresh it so it cannot be mistaken for the current live workflow.

---

# 11. Known open items

0. **PLANNED** — deploy and verify the reusable U15 player-code Supabase migration/Edge Function before treating name + reusable-code login as end-to-end functional.
1. **PLANNED** — fix and verify the readable `build-apk-static-feed.yml` artifact  
   gate, then retire/delete `build-apk.yml` so exactly one workflow can publish a  
   shippable APK.
2. **PLANNED** — verify the exact APK distributed/installed after cutover.
3. **PLANNED** — capture populated Selkent fixture markup and test parser.
4. **PLANNED** — capture populated U12+ published-result markup and test parser.
5. **PLANNED** — spot-check a real non-zero standings table when available.
6. **PLANNED** — complete separate defence-in-depth review of backend access  
   surfaces already identified in security notes.
7. **PLANNED** — remove the dead legacy `activateAssignment()` activation path,  
   obsolete activation-gate UI and unused native sign/verify assignment stubs from  
   the current Android source; only mark BUILT after inspecting a rebuilt APK.
8. **PLANNED** — fix the live readable v2.2.4 workflow's multidex verification  
   (current check looks only in `classes.dex`; marker is in `classes2.dex`),  
   successfully upload and inspect its artifact, and remove/refresh the stale  
   v2.2.2 `build-apk-static-feed.REPLACEMENT.yml` sidecar bundled in the source ZIP.
9. **PLANNED / BLOCKED BY GITHUB WRITE PERMISSION** — add the verified U8/U9  
   `divisionsspage` captures from Drive into `tests/fixtures/`; ordinary  
   repository file creation currently returns HTTP 403 from the integration.
10. **PLANNED** — re-fetch and verify U10X/U12/U14/Senior `divisionsspage`  
    payloads; only U8/U9 are currently verified captures.
11. **PLANNED** — reconcile the GitHub-root `ARCHITECTURE.md` with the canonical  
    Drive `00 - CURRENT MASTER/ARCHITECTURE.md`; they currently differ.
12. **PLANNED** — remove duplicate identical repo files `scripts/scrape (1).py`  
    and `tests/test_selkent_scrape (1).py` after confirming no workflow references  
    them.
13. **PLANNED security hardening** — review current Supabase advisor findings:  
    1 mutable function search_path WARN, 3 anon-callable SECURITY DEFINER WARNs,  
    68 authenticated-callable SECURITY DEFINER WARNs, leaked-password protection  
    disabled, plus 37 RLS-enabled/no-policy INFO findings. Existing manual review of  
    the 16 safeguarding-path SECURITY DEFINER functions found real auth/scoping  
    checks, so advisor counts are review targets rather than confirmed exploits.
14. **PLANNED** — build the canonical club-logo catalogue for every club currently in the supported directory, store logo assets in the chosen public asset store/CDN, add logo metadata to the directory contract, implement club-selection auto-population and neutral fallback behaviour, and add a verified club-admin logo replacement path.

---

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

## 2026-09-20 - Corrected stale product-name and UI-standard references

Aligned prose with APP-UI-DESIGN-GUIDELINES.md v1.4 and the PitchKind name decision (AI-HANDOFF-LOG.md entries 16 and 17). Title, product-name note, sections 2.7 (including a reference to BRAND-GUIDELINES.md), 2.8, 7 and 9.7 updated. No data scope, source-of-truth category, integration, backend or status claim was changed. Code identifiers, file names, repository names and artifact names containing the old name are unchanged until the rename implementation is authorised. Trade-mark clearance is NOT completed.

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
