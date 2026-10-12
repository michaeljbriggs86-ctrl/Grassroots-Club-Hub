# Selkent cup scraper failure — 12 October 2026

Latest failed run: 38217589605, job 114705855261, on PR85's branch at
b15c243a762f57c0677265449a3a8bdd5af7e3f0. Its parser fixture tests passed,
but the subsequent live scrape stopped at 07:26 UTC with
`UnverifiedPublishedResultsMarkupError: Unknown cup score/team: 'W - L'`.
The public-feed commit step was skipped. App/UI and parent-privacy checks
at that same commit were successful.

## Verified provider row and handling

Read-only retrieval of `https://www.selkent.org.uk/public/cupspage/8`
confirmed the W - L row: Selkent Cup One, Round 1, 11 October 2026,
match reference A, Sporting Club Vista versus Omarie Youth Red. Its .vCol
contains an outcome marker rather than a numerical goal score. The other
three round results are 2–3, 3–1 and 3–5.

The committed fixture contains that actual competition/round panel, with
the tab wrapper retained and unrelated page content removed. It contains
public U13 match data only. The parser now recognises W - L and the inverse
L - W, allowing compact spacing, as non-numeric outcomes. Such rows do not
enter the goals-only published-results feed or standings; no goal score is
invented. Both team names must be populated. Unknown tokens, unfamiliar
markup and invalid dates still stop publication. Existing U12+/Senior
eligibility and U7–U11 restrictions stay in place.

Regression cases cover the real row, all three neighbouring numeric scores,
the reversed outcome, compact spacing, missing team names and unknown
tokens (including W-W, L-L, W-0 and descriptive result text). Existing cup
fixtures and eligibility checks remain in use.

## Workflow separation

The public scraper previously ran on pushes to any branch, including a PR
merge-resolution commit. Production pushes are now limited to main. The
live scrape/write job also checks main explicitly and retains schedules and
manual main runs. Pull requests run a separate fixture-validation job with
read-only permissions and no persisted checkout credentials. Only the
production job receives contents write permission. Concurrency remains
serial within each ref, so PR validation does not occupy the main producer's
queue. The sole generated publication target remains data/results.json.

No old failed run is rerun as if it could use corrected code: reruns retain
their original commit. New PR checks validate the replacement revision.
No protected website deployment, PR merge or private R2 publication is part
of this fix. The older private snapshot/parity failures are separate from
this public-parser failure; their safety gates remain enabled.

## Validation

All 140 Python regressions passed, including seven cup parser cases. Workflow
YAML checks confirm main-only production pushes, read-only PR validation,
no persisted validation credentials and a write grant confined to the live
main scrape job. Diff checks passed. No generated feed was committed by
these local tests.
