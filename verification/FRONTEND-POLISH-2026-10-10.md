# Frontend polish: fixture timing and matchday preparation

Based on main e1b09d2431d28d8ceb69d1a949d1554c8c5b8843. Mike authorised implementation with “Make the changes” after the 2115 visual-polish brief. Scope is the brief's first three priorities.

Known kick-off remains visible to staff while match-detail confirmation and fixture acknowledgement have separate wording. Missing time is TBC. Group events use Group starts. Home's detail renderer resolves cup-group details instead of first-row defaults. Existing parent and share publication/confirmation gates remain intact.

Home preparation uses one shared surface with divider rows, 15px values and 12–13px supporting copy. Availability leads with unanswered replies and retains all four counts. Squad and formation remain distinct. The squad/tactics button is first in both document and visual order, with secondary controls following. Mode labels and competition-round text are 12px. The approved hero dimensions, club admin white hero, badge rules, notes, season collapse and parent experience are preserved.

## Validation

- Updated the obsolete source-regex kickoff test to exercise the dashboard, shared canonical data and final Home/detail/Matches timing renderer. Covers known/unconfirmed, confirmed, changed acknowledgement without mutation, missing time, group start, neutral Marathon, availability counts and parent exclusion.
- Existing dashboard layout tests pass, including map clearing, venue changes, admin preview and absent fixtures. Missing-time fixture now explicitly has no published time.
- Entire JS suite: unchanged main 78/84 PASS; this patch 79/84 PASS. No new failing file. Five inherited failures: parent_family_summary, pitchkind_cup_fixtures, web_admin_summary_dialogs, web_fixture_without_standings, web_mobile_navigation.
- Existing v2.2.30 UI verifier: same 33 FAIL lines on both trees. This is not a passing full release gate.
- JavaScript syntax, whitespace and cloudflare/web-app/build.py PASS, including pilot rights checks. Generated app.js, index.html and app-design-system.css bytes match source.

## Open acceptance

The managed environment has no supported browser-control preview capability. The Sites workflow requires skipping preview in that situation. No replacement browser path or synthetic screenshot was used. No viewport, 200% text, dark/light rendering or signed-in runtime acceptance claim is made. Verify 360/390/430/600/768/900 widths, long team/competition labels, enlarged text, normal-height scrolling and staff/parent roles before final acceptance. Cloudflare Access protects the running site; local tests use invented fixtures only.

This branch is reviewable source, not proof of a deployed/running revision. The separate nine-item UI review patch, badge work and domain-core rebuild are not bundled here.
