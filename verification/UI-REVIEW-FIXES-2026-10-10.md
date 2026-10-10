# UI review fixes — 2026-10-10

Status: TESTED locally; static browser bundle BUILT and inspected. Publishing
for independent review; protected signed-in browser acceptance remains OPEN.
Base: main `e1b09d2431d28d8ceb69d1a949d1554c8c5b8843`.

The nine review findings are addressed in the existing client:

1. Recent form and recent results exclude scheduled/postponed fixtures.
2. Phone form chips keep their 34px square size; the empty message can expand.
   These two changes reuse Claude's `b61f6a68be4d421ed223e5f5d8e67c40a625d521`
   (cherry-picked locally), with the empty-message selector narrowed afterwards.
3. All generated authentication fields have persistent associated labels and names.
4. Adult and parent sign-in use native form submission, including Enter, prevent
   page reload and duplicate in-flight submission, and keep the parent-role checks.
5. The four reported static fields have accessible names. Generated club/team/
   league selects also have names; authentication errors are announced.
6. Main screen and Club tab routes use `?view=...`, restore after account bootstrap,
   and respond to browser Back/Forward. Unknown/forbidden routes are resolved
   through existing role guards. Other query parameters/auth fragments are preserved.
   Routing does not add URLs for every filter, dialog, or squad subpanel.
7. Tactics players move with arrow keys (Shift = larger steps) or by selecting a
   pitch player then tapping an empty spot. Both use existing persistence and
   staff permissions. Existing drag/swap behavior is retained; redraws restore
   focus and movement is announced to assistive technology.
8. Reduced-motion preferences disable animations/transitions and smooth scrolling.
9. The approved Inter family is actually loaded from a self-hosted variable WOFF2,
   preloaded with `font-display: swap`, included in both client/web assets and the
   service-worker allowlist, with the unchanged OFL licence and pinned provenance.

## Evidence

- Eight focused JavaScript test files PASS, plus client syntax and whitespace checks.
  New probes run the actual route guards/history handler, field renderer, recent
  results block and tactics key/tap handlers against synthetic browser stand-ins.
  Existing parent sign-in checks still reject staff on the parent-only route.
- All JavaScript tests: 80/85 PASS; untouched main: 78/84 PASS. Five failing files
  are inherited from main. The sixth main failure was a stale mobile-navigation
  harness; it now represents the existing current design. No new failing file.
- Existing UI verifier: identical 33 FAIL lines on main and this branch. This
  legacy verifier is not a passing release gate and does not establish full UI parity.
- `python cloudflare/web-app/build.py` PASS. Reviewed modified client files, font
  and licence match their actual generated bundle bytes.
- FreeType `fc-scan` identifies Inter Variable, Regular through Black weights.
  Font SHA-256: `693b77d4f32ee9b8bfc995589b5fad5e99adf2832738661f5402f9978429a8e3`.
- Added a PR workflow for the focused checks and actual bundle build. Remote CI
  has not run for these changes.

Inherited failures: `test_dashboard_kickoff_visible.js`,
`test_parent_family_summary.js`, `test_pitchkind_cup_fixtures.js`,
`test_web_admin_summary_dialogs.js`, `test_web_fixture_without_standings.js`.

## Delivery policy

The earlier selected GitHub integration returned HTTP 403 for branch creation.
After Mike updated access, branch creation succeeded on 2026-10-10 for
`codex/ui-review-fixes-2026-10-10` from the unchanged main revision above.
The changes are being published for independent review on that separate branch.
Main parity/review gates still apply; no main merge or live deployment is claimed.
The previous self-contained installer remains a fallback and must not overwrite
an existing review branch. Remote check outcomes are recorded on the pull request.

No new database, access-control, badge, Cloudflare setting or account changes.
No current child/account data was read. Browser behavior is tested in isolation;
signed-in desktop/phone rendering, keyboard/screen-reader use, and served revision
acceptance still need the protected page. The Cloudflare Access wall is unchanged.
