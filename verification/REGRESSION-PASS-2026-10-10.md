# Regression pass — 2026-10-10

Status: TESTED locally; existing browser client bundle BUILT and inspected.
This change updates tests and their PR workflow. Production client assets and
public feeds are unchanged. Independent PR review remains open.

Base: main `ab0c9980ec4cef6c9a06f08435d1963ac53d7104`.

## Reproduced failures and corrections

| Test | Baseline failure | Correction and retained coverage |
|---|---|---|
| `test_parent_family_summary.js` | `ReferenceError: parentCupGroupDetails is not defined` in the isolated renderer; obsolete two-session training expectation | Load the actual cup helpers, pin the training clock, and verify this-week/later collapsed sections. Keep parent/account/team isolation, stale-request rejection, empty/error state checks; add confirmed second-fixture cup-start rendering. |
| `test_pitchkind_cup_fixtures.js` | `0 !== 2` after its October 4 fixtures expired under the real clock | Pin the admin builder clock and exercise before/day-of/after filtering. Retain exact cup-team, division, competition and home/away assertions. |
| `test_web_admin_summary_dialogs.js` | Source extraction for deleted `openAdminClubList` and dialog handlers failed | Retain the legacy filename but execute the current summary handler. Assert routed fixture/results pages, overview role gate, focus, missing-target behavior and actual reduced-motion helper. |
| `test_web_fixture_without_standings.js` | Mutable scraped feed returned October 11/18 versus fixed September 27/October 4 expectations | Supply a synthetic schema-v2 feed with an empty standings table, two own fixtures and an unrelated division. Assert static fixture authority, no live fallback, stale table replacement and clearing cached fixtures when the authoritative feed is empty. |

All four failures were test drift; no production defect was demonstrated by
these failing cases. No client implementation or visibility gate was relaxed.
Existing parent/cup integration and access tests are included in the full suite.

## Evidence

- Untouched base: **81/85** JavaScript test files PASS. Only the four files above fail.
- Updated tree: **85/85** PASS. All test files run individually with Node 24;
  the two final additional assertions were then rechecked in their affected files.
- Four disposable source mutations were rejected with assertion failures:
  remove parent link isolation; retain expired admin fixtures; remove the
  admin overview guard; retain old fixtures on an authoritative empty response.
  No mutation was applied to the actual worktree.
- `python cloudflare/web-app/build.py` PASS, including pilot-rights scope checks.
  Raw app/cloud/index/design-system/font asset bytes equal source. The built
  static-feed overlay matches the build's deliberate same-origin URL/source
  rewrite; it is not expected to equal the original overlay bytes.
- Whitespace checks PASS.
- The legacy v2.2.30 UI verifier remains at **33 identical FAIL lines** on both
  base and updated trees. This is separate from the now-passing JavaScript suite;
  no passing full UI parity/release gate is claimed.

The PR workflow now runs every `tests/test_*.js` file, including these four,
instead of a fixed subset. It retains client syntax checks, actual web build,
font/licence byte comparisons and whitespace checks. Remote run outcomes are
recorded in the PR description and shared handoff after publication.

No new live-page visual acceptance is needed for a client change in this patch,
because the patch contains no client change. This is not an independent claim
that every protected role, device or accessibility combination has been tested.
No database, badge, account, access-control or deployment change is included.
