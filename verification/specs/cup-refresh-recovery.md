# Selkent cup transport recovery — 14 October 2026

The 14 October scheduled public scrape failed at the advertised U12 cupspage/6
with HTTP 500. The U12X deferral did not restore publication. The canonical feed
remained dated 12 October 13:49 UTC; the private verifiers rejected its age.

## Reviewed behavior

Figma: https://www.figma.com/design/NY8QhcuOWiEcD0pKDTsbP8?node-id=299-6414
Preimplementation Drive record: LOG-ENTRY_2026-10-14_2010_chatgpt_cup-refresh-recovery-figma-review.md.
Current governing Drive architecture and repository mirror record the contract.

Only a timeout, connection failure (excluding TLS failures) or HTTP
429/500/502/503/504 from cup collection may retain the prior complete canonical
cup segment. Fixtures and league results/standings must collect successfully.
Unknown populated markup, source identity conflicts, other HTTP errors and an
unverified/unsafe/missing baseline abort atomic publication as before.

The retained baseline has schema/provider/parser, exact age/format identity,
safe public-only cup fields, valid scores/match dates and original verification
date checks. League rows are always from the new collection. Current main's
87 retained cup scores pass these checks. U12X is still explicitly deferred.

`last_updated` covers fixtures and league data. `cup_results_last_updated` stays
at the original verified cup check date while `cup_results_status` is
`stale_retained`. Admin and Coach results show the dated source warning using
the existing status element. Successful cup collection replaces retained rows,
sets `verified_current`, and removes the warning; verified empty cups can clear
prior rows. Repeated outages cannot move the cup check date forwards.

The private shadow independently collects fixture/league/table HTML only.
League comparisons exclude canonical cup rows. A private candidate retains
exact canonical cup rows and their check date/status; Python verifies that
preservation. This does not independently verify cups or create a new authority.

## Validation boundary

Local parser, recovery, private parity, candidate/route and client regressions
pass. The browser package builds, and source/UI checks pass. Local browser
downloads are unavailable/truncated; the built browser verifier is wired into
hosted UI CI and must pass before release. It exercises Admin/Coach, both
themes, 320/393/1024px, 200% text, stale warning, retained score, recovery and
existing unavailable state. No real accounts/children or external messages.

Live public refresh, protected served revision and independent verification
must be checked separately; source tests alone do not establish them.
