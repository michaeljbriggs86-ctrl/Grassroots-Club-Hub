# PitchKind screen and profile consistency pass

Request: Parent Home and Matches do not look like the other screens; review every screen across every profile and correct inconsistent presentation.

Initial audit base: `96c4a8cbffaafe6443d11cf9fac5da51420217fb`, including merged frontend PR48 and regression PR47. Final publication base: `4d654d835828d451a6e6c8176d22e88faf881b64`; concurrently merged badge PR49 and automated directory publication were imported byte for byte and preserved. The browser build was rerun successfully on that combined tree. This is a source and behavior audit, not a rendered or authenticated live audit. The protected live app was not opened, and no real account or child data was inspected. The managed environment has no supported control-browser capability; the Sites workflow requires skipping preview in that case.

## Changes

- Introduced `screen-lead-card` as the shared green top border, 18px radius and shadow treatment. Applied to Home, both parent activity alternatives, Matches, parent training on Schedule, League, match entry, Squad, Inbox, admin notifications/notices, overview, fixtures, results and coaching staff.
- Parent training and match details now use the same heading, value and helper sizes on Home and Schedule. Removed the Schedule-only compressed training presentation through scoped overrides. Confirmed ordinary match details continue the Home summary card, like staff preparation; cup-group details remain a complete standalone card. Training leads unconfirmed Parent Home and Schedule. A supporting Schedule training card loses the lead accent when a confirmed fixture already leads.
- Parent Schedule's heading now matches its navigation label. Switching back to a staff profile restores “Matches”. No role or fixture visibility decision changed.
- Shared screen headings and action rows wrap. Card/form labels and body text use 14px, helpers 13px, section headings 18px and kickers 12px. Full text buttons use 48px targets; screen switches use at least 44px. Settings summaries, empty/loading copy, form fields and modal headings/actions follow the same hierarchy. Narrow modal actions stack without imposing that layout on fixture-specific action bars.
- Matches/Schedule and the next-fixture dialog use the same soft green fixture surface, readable team links and kit labels, with explicit dark equivalents. The team/badge/kit structure and badge dimensions are unchanged.
- Preserved the compact hero and Club Admin white hero, Inter and approved greens, selected states and focus rules, watermark/artwork, existing table scrolling, permissions, safeguarding paths and parent child filtering. No cloud, feed, database, badge pipeline or private asset changes.

## Main screen/profile coverage

“Shared” means the screen's source and governing styles were reviewed; it does not mean a signed-in visual inspection occurred. Destinations refer to the existing production navigation policy. The new test exercises all 12 route names against all seven active modes and confirms exactly one active screen after each navigation.

| Screen | Coach / Assistant | Parent | Player | Club Admin overview | Admin Coach | Admin team preview |
| --- | --- | --- | --- | --- | --- | --- |
| Home | Shared match summary/preparation | Training or confirmed match, family/notices | Shared read-only Home | Club overview | Shared coaching Home | Shared read-only team Home |
| Matches | Shared fixture, records and competition sections | Schedule: confirmed fixture/training or pending note | Shared read-only Matches | Club overview | Shared coaching Matches | Shared read-only Matches |
| League | Shared standings/fixtures when published | Home redirect | Shared when published | Club overview | Shared when published | Shared when published |
| Add / edit match | Shared form | Home redirect | Home redirect | Club overview | Shared form | Home redirect |
| Squad / Match plan | Shared tabs, roster and plan | Home redirect | Shared read-only team | Club overview | Shared editable team | Shared read-only team |
| Inbox | Shared conversation/concern cards | Shared parent conversation/concern | Home redirect | Communications | Shared communications | Shared communications |
| Settings | Shared accordions/account | Shared appearance/account/family controls | Shared appearance/account | Shared club/account settings | Shared team/account settings | Shared read-only context/settings |
| Club overview | Club Results destination | Home redirect | Home redirect | Shared overview | Switch to club overview | Switch to club overview |
| Club fixtures | Club Results destination | Home redirect | Home redirect | Shared fixtures | Shared club fixtures | Shared club fixtures |
| Club results | Shared results | Home redirect | Home redirect | Shared results | Shared club results | Shared club results |
| Coaching staff / access | Club Results destination | Home redirect | Home redirect | Shared management | Shared club management | Shared club management |

The test isolates navigation; deeper authorization remains in the existing actual access-mode and cloud handlers, exercised by the full regression suite. The table does not imply a read-only preview can submit club management actions.

## Secondary screens and states reviewed

- Squad and Match plan; Inbox, Notifications and Club notices; club overview/fixtures/results/coaching staff; results tables, cup/vase/tournament panels and season summaries.
- Settings: training, match features, team access, rules/procedures, Club Admin access, season management, compliance, safeguarding, season history, audit history, appearance and account/family controls. Existing role and reviewer assignment conditions remain authoritative.
- All 14 dialogs: context switch, next fixture, weekend share, recorded match details, club details, parent request review, add child, parent link, player profile, player edit, award, tournament, season archive and notifications (plus their forms and action rows).
- Account entry/sign-in, invite/join, coach approval, parent approval and generic pending-access states use the already governed authentication composition. Pending Coach and Pending Parent are approval states, not additional active dashboard profiles; no navigation access was added. Assigned dispute-reviewer tools remain an Inbox capability rather than a new dashboard profile.
- Source branches for no fixture, unconfirmed/confirmed fixture, ordinary/cup-group matchday, current/later/no training, loading/error/partial replies, linked/no-linked family, read-only forms and empty records were reviewed. Existing synthetic tests cover parent fail-closed refresh, current-account/team isolation, training priority, cup groups, admin modes and fixture permissions.

## Verification

- 86/86 existing and new JavaScript test files PASS. New `test_profile_screen_routes.js` checks 84 real navigation cases across seven active profile modes. Existing tests cover published/unpublished teams, forbidden deep links, role access, parent family privacy and account transitions.
- Actual browser bundle build PASS, including pilot rights scope; generated CSS, HTML and app JavaScript match the source files byte for byte.
- `git diff --check` PASS. The base import's whole tree matched remote `d20cb437dd22cee6db8c1e02166d14f0ae9baa2f` before editing.
- No full release-parity claim: the unrelated legacy v2.2.30 verifier's inherited failures were not rerun or repaired in this presentation pass.

## Live acceptance still required

Render each accessible screen in the matrix on the protected app, light/dark, at 360/390/430/600/768/900 widths and enlarged text. Pay particular attention to Parent Home with unconfirmed training, confirmed ordinary match, cup group, no linked child and reply load failures; Parent Schedule with/without confirmation; long names/venues; dialogs and keyboard focus; Admin overview/Coach/preview switches. Confirm no overflow, correct card joins and retained selected/focus/disabled states. Source tests and bundle checks establish neither these rendered properties nor a served live revision. Keep the established independent-review gate before merge.
