# Selkent Cloudflare shadow collector

This is the first, isolated stage of moving public Selkent collection to
Cloudflare. It does **not** publish a feed or change the PitchKind website.
`scripts/scrape.py` and `data/results.json` remain the public authority.

Every six hours, 15 minutes after the GitHub feed schedule, the Worker reads
the current validated public `data/results.json` and fetches the listed public
fixture weeks and U12+ results tables from Selkent. The current feed names 45
fixture endpoints and 53 results-table endpoints. It checks the response
contracts and writes all returned HTML together to one private R2 object,
`shadow/latest.json`, **only after all targets succeed**. On any error it
leaves the previous object untouched and the scheduled event fails. It does
not fetch private match reports or U7–U11 result tables.

On Sundays it also checks at :00 and :30 from 08:00 through 19:30 UTC. That is
09:00–20:30 during British Summer Time and 08:00–19:30 during GMT. The normal
six-hour check still runs at :15, so the schedules do not collide. These
additional private snapshots help validate live match-day changes; they do
not refresh the app or change the six-hour GitHub public feed. Wait for real
provider results and verified parser parity before increasing public updates.

The source feed is used only as the pilot's list of known public endpoints;
new age groups, fixture weeks or divisions are discovered by the existing
GitHub scraper. The R2 snapshot is unparsed evidence, not an app-facing JSON
source. Do not attach a public R2 domain or route to this bucket. The Worker
returns 404 if someone attaches a hostname accidentally.

## Deploy from GitHub Actions (works from a Termux source checkout)

Add repository secrets `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`
under GitHub Settings > Secrets and variables > Actions. Scope the Cloudflare
token to this account with Workers Scripts Edit and Workers R2 Storage Edit.
From the GitHub Actions tab, run **Deploy private Selkent shadow collector**
manually. Its Linux job reruns the tests and Wrangler dry run, creates the
private R2 bucket if missing, then deploys the scheduled Worker. Source push
alone does not trigger deployment. Do not put token values in this repository.

## Alternative: authenticated Cloudflare shell

From the repository root, run:

```sh
node --test cloudflare/selkent-shadow/tests/shadow.test.mjs
cd cloudflare/selkent-shadow
npx wrangler deploy --dry-run
npx wrangler r2 bucket create pitchkind-selkent-shadow
npx wrangler deploy
```

Use `npx wrangler login` first if this shell is not authenticated to Mike's
Cloudflare account. If the bucket already exists in that account, skip the
create command. Wrangler must be connected to the account that owns the paid
Worker plan. No API token or R2 credential belongs in Git.

`wrangler.jsonc` has no public `workers.dev` URL or custom route. The crons are
`15 */6 * * *` and `0,30 8-19 * * SUN` in UTC; allow for propagation after
deployment. Inspect the Worker's Cron Events and logs for
`selkent-shadow-collected` and the target count. Confirm the private bucket
contains `shadow/latest.json` with matching `canonical_feed_last_updated`,
98 targets (at the initial September 27 feed), and payloads for
`resultsTable/4249` and each known fixture week. Do not treat a successful
local test or a pushed commit as proof that the production cron ran.

## Verify private R2 snapshots

Push the verifier source to start **Verify private Selkent shadow snapshot**
once, or run it manually under GitHub Actions. It uses the existing Cloudflare
repository secrets to download `shadow/latest.json` to the job's temporary
directory with `wrangler r2 object get --remote`, checks that it was collected
within two hours, checks every named payload and its count, and compares exact
targets to `data/results.json` when their feed timestamps match. The job prints
only counts and timestamps; it does not upload the private HTML as an artifact.
On Sundays a public feed may update after the private snapshot, so a newer feed
defers the exact target-list comparison without hiding a stale or incomplete
snapshot. The job fails if any required structural or freshness check fails.
Scheduled runs require a collection no more than two hours old. Push and
manual runs allow seven hours because the collector normally runs every six
hours; this permits an on-demand parser comparison between collection times
without relaxing the scheduled freshness gate.
For a stale snapshot the failure prints only the collection and scheduled
timestamps and its age in minutes, so the failure can be compared with the
Worker's Cron Events without exposing provider HTML.

It also runs at :45 after the regular six-hour private collector and at :50
each hour on Sunday 08:00–19:59 UTC. GitHub scheduled workflows may start
later than their cron time. A successful scheduled verification demonstrates
that a fresh private snapshot existed at that time; it does not establish
parser parity with the public feed or switch website data sources.

The verifier also runs a read-only parser comparison against the current public
feed. It reuses the proven Python fixture, standings and scored-result parsers,
prints counts and how many age groups differ in each section, and never
publishes or uploads private HTML. `exact` means the two captures matched;
`drift` reports a difference that can occur when Selkent changes data in the
minutes between public and private collection. A different canonical feed
version defers the comparison. Unknown markup or a restricted age group's
results fail the check. This comparison is a migration gate, not an automatic
source switch.

## Graduation gates

1. Capture multiple successful scheduled collections and snapshot verification
   runs; inspect failures or provider blocking without changing the live feed.
2. Port the verified Python parsers and public-age privacy checks to the
   Cloudflare pipeline. Compare normalized fixture, result and standings
   output against the GitHub feed across all age groups and real changes.
3. Only after parity, publish one validated schema-v2 JSON object atomically
   to R2; serve it at `/data/results.json` through the existing Access-protected
   website Worker with explicit caching. Keep the GitHub feed as a monitored
   fallback during the migration, never as a second writer to the same R2 key.
4. Once the live website and recurring runs have been checked, update the
   source-of-truth register and retire the superseded publication schedule.

The complete paid-plan run is below the 10,000-subrequest allowance, but the
scheduled Worker still has a 15-minute wall-time ceiling. If real runs approach
that limit, split collection into retryable Cloudflare Workflow steps before
expanding this pilot to feed publication.
