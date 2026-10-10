# Current UI source gate reconciliation

Status: TESTED against main `4d654d835828d451a6e6c8176d22e88faf881b64` (10 October 2026). This changes verification, regression tests and CI only.

The Android workflow calls `verify_v2_2_30_pitchkind_ui.py`; its historical filename is retained for compatibility. It continues to enforce native version 2.2.35 / build 2235. On current main it reported 158 passes and 33 failures. The failing assumptions predated the approved signup, canonical fixture cards, share icons, permission rules, artwork preservation and rolling feed changes. Returning the UI to those assumptions would regress approved behavior.

All 191 checks remain. The 158 previously passing conditions are unchanged (135 literal checks plus 23 checks expanded by existing loops). The 33 replacements below validate current requirements. Runtime test assertions, missing Node/test files and timeouts fail the gate; regression files are run once per invocation and shared between relevant requirements. Android CI pins Node 24. The PR workflow now runs the source gate and triggers when it changes, alongside the full JavaScript suite and browser build.

## Evidence and decisions

- A cache label is no longer tied to an APK version. Native asset URLs still carry build 2235 and use `LOAD_NO_CACHE`. Service workers register only on HTTP; the runtime regression checks installation, asset existence, activation cleanup and client takeover.
- The public U9 feed now advertises weeks 4/5 and 56 rows, replacing weeks 2/3. Validate rolling rows and provider identities instead of retaining September dates forever. A real Cup row has an unresolved `TBD` opponent with one provider ID; require two IDs for resolved rows and one for that case. Existing scraper tests still verify historical multi-week discovery and the September/October fixture examples using fixed fixtures.
- Commit `12a559f55bf490db37a30123430f39e2e4c30d62` deliberately stopped match-report notifications, including undo notifications. Retain the server RPC contract but assert no retired client calls in undo.
- Club Admin preview does not confer fixture write permission. Execute the current guard's positive and negative coach/cloud permission controls.
- Verified badges retain complete artwork in contain slots. The shared canvas keeps aspect ratio and clips only the known bundled Shooters Hill fallback. Canonical monograms remain clearly identified placeholders, with the product fallback for unknown clubs.
- Persistent action placement is checked by HTML nesting, not by finding a later matching button elsewhere in the document. Further fixtures may use a confirmed Maps link rather than requiring an iframe on every compact card.
- Share privacy is exercised with private fields on resolved fixture inputs and a private player-state getter that throws. Both an ordinary match and a Cup group must export while excluding private fields from canvas text and caption.

## Replaced checks

| Previous check | Current requirement |
| --- | --- |
| v2.2.35 fresh native assets and visible build marker | v2.2.35 native cache bypass, build marker and service-worker lifecycle |
| fallback uses PitchKind mark | club hero fallback uses PitchKind mark without retry loops |
| verified populated U9 multi-week fixture feed retained | U9 rolling fixture feed retains verified discovery and provider identities |
| full future fixture list is accessible | full future fixture list is accessible with Cup grouping |
| undo correction notification RPC wired | undo does not send retired match-report notifications |
| further fixtures use full visible identity venue and map treatment | further fixtures show identity and confirmed Maps while parent Cup cards remain compact |
| v2.2.35 popup keeps actions with their details and frees the bottom bar | fixture popup keeps timing, Maps and availability details with persistent actions |
| only important announcements override prime Next Fixture | parent updates include ordinary notices and staff notices retain important priority |
| Tactics board is above matchday squad controls | Tactics board precedes collapsible formation and squad controls |
| Rules procedures are staff-only and use configured age rules | Rules procedures remain staff-only with age-specific privacy and official match-card guidance |
| verified club badge hero uses circular artwork presentation | verified club hero preserves approved artwork without blanket circular cropping |
| parent self-signup is exposed from adult login | adult login exposes unified Create Account and dedicated parent sign-in |
| parent self-signup collects account club team and child | unified signup collects account, club, team and free-text child for parents |
| parent self-signup uses public login directory selectors | unified signup uses public club and team directory selectors |
| coaches see pending child identity before approval | coaches see pending child identity before approval |
| verify screen supports manual return when deep link fails | verification screen gives explicit manual sign-in return |
| notification content wraps and actions stay usable | notification content wraps and actions stay usable |
| Share matchday image contains no player data or score fields | matchday image and caption exclude private player data and score fields |
| v2.2.26 verified badge or generic club placeholder is always primary identity | approved badge takes priority over explicitly labelled club monogram |
| generic placeholder is based on club identity and colours rather than PitchKind product mark | club monograms use canonical identity and unknown clubs keep the product fallback |
| Club Admin team preview can confirm fixture details | fixture confirmation requires coach capacity and cloud write permission |
| confirmation and share actions are explicit and visible to staff | accessible share actions follow staff permission and confirmed details |
| match image is badge-first and built from confirmed key matchday details | ordinary and Cup matchday images render badges and confirmed time, arrival, venue and kit |
| v2.2.27 share controls are visible in popup and Matches next-fixture card | share controls remain visible to authorised staff on popup and Matches |
| v2.2.29 share remains visible but requires confirmed key details before native sharing | share requires confirmed key details before native or web export |
| v2.2.28 confirm and share live outside the scroll region in persistent footer | confirm and accessible share actions remain outside the scroll region |
| v2.2.28 staff actions share the same role gate and are not buried | staff share and confirmation actions enforce coach write permission |
| v2.2.29 arrival time is fixed at 30 minutes before kickoff | arrival is 30 minutes before ordinary kickoff or Cup group start |
| v2.2.29 WhatsApp caption carries HTTPS Maps link and key matchday fields | WhatsApp caption carries HTTPS Maps, confirmed kit, venue and ordinary or group timing |
| v2.2.29 share UI uses matchday wording | share icons expose accessible match-details wording |
| v2.2.35 verified badge clips opaque source corners in UI | verified UI badges preserve complete approved artwork |
| v2.2.35 verified badge is circularly clipped on shared canvas | shared canvas preserves badge aspect ratio and only clips known bundled fallback |
| v2.2.35 matches team names and actions remain readable | canonical fixture names and current result tables retain readable staff actions |

## Validation

- Source gate: 191 passed, 0 failed; unchanged main baseline: 158 passed, 33 failed.
- JavaScript suite: all 86 `tests/test_*.js` files pass, including the new source-contract test.
- Python suite: all 123 discovered tests pass, including fixed-fixture multi-week parser tests.
- Club logo quality gate, protected browser build, emitted font/license byte comparisons and `git diff --check`: PASS.
- Six deliberate regressions each made the source gate fail: truncate future fixtures to eleven, grant admin preview confirmation, leak private score into share caption, circularly crop all verified badges, retain old service-worker caches, and alter approved logo bytes. Original files were restored byte for byte after each check.

These are source and local build checks. No signed-in live-page inspection or APK artifact build is claimed by this change. Independent review precedes any merge/deployment claim.
