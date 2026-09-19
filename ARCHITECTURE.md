
# Grass Roots Club App — Data Architecture Reference

**Status:** Living document.

This document is the governing reference for decisions involving:

- data scope
- data sources
- source-of-truth ownership
- public vs private data
- Selkent integration
- update frequency
- identity/linking strategy
- safeguarding/compliance boundaries
- test/synthetic data

Read this document before making changes to any of those areas.

---

## 0. Revision Protocol

This document must be revised **immediately, before further implementation work**, whenever any of the following occurs:

- A conflict is discovered between this document and the real system.
- A system is found to be doing something not documented here.
- A privacy/access assumption turns out to be wrong.
- A source-of-truth decision changes.
- A new data type, system, scraper, API, import process or integration is proposed.
- A legal, FA or safeguarding rule is discovered that affects collection, storage, access or publication.
- An update-frequency assumption proves incorrect in practice.
- An identifier believed to be stable or authoritative turns out not to be.
- Synthetic/test data starts being used for a new purpose not already described here.

### When a conflict is found

Stop.

Update this document first.

Then resume implementation.

Do **not** patch code first and update this file afterwards.

The purpose of this document is to prevent architecture drift and parallel systems developing independently.

The previous existence of three separate Selkent data paths is the reason this rule exists.

Every material addition or correction must also be recorded in the changelog.

---

# 1. Data Classification

For every significant category of data, this section records:

- what it is
- whether it is public or private
- where it is allowed to live
- which age groups it applies to
- any important handling restrictions

| Data type | Visibility | Where it lives | Age scope | Notes |
|---|---|---|---|---|
| Selkent club directory | Public | GitHub static JSON: `data/directory.json` | All ages | Canonical Selkent club list. Clubs have stable Selkent club IDs from `/public/clubs/{id}` |
| Selkent divisions / team membership | Public | GitHub static JSON: `data/directory.json` | All ages | Contains division names and teams belonging to each division. This is **not** a league standings table |
| Selkent fixtures | Public | GitHub static JSON: `data/results.json`, once generalized | All ages | Selkent publishes fixtures publicly for all age groups. Current `results.json` implementation is still U9-only |
| Selkent published match results | Public | GitHub static JSON: `data/results.json`, once generalized | **U12+ only** | Selkent does not publicly publish results for U7-U11 |
| Selkent league standings | Public | GitHub static JSON: `data/results.json`, once generalized | **U12+ only** | Confirmed live endpoint: `resultsTable/{division_id}` exposes Team / Played / Won / Drawn / Lost / GF / GA / Points |
| Club-entered U7-U11 match results | **Private — club scoped** | Supabase via `save_team_state` / `get_team_state_for_me` | U7-U11 | Clubs may record their own younger-age results internally. They must never enter GitHub public JSON or a public-facing view |
| Team rosters / player data | Private | Supabase | All ages | Access controlled through team/club role rules |
| U7-U11 safeguarding information | Highly restricted private data | Supabase private/public controlled functions | U7-U11 | Emergency contacts, medical/allergy information and related safeguarding records |
| Safeguarding export audit | Restricted private data | Supabase | U7-U11 | Records who exported safeguarding data, when and for which players |
| Club safeguarding contacts | Club scoped | Supabase | All | Welfare Officer / County FA safeguarding contact details |
| Club compliance configuration | Club scoped | Supabase | All | Some values currently exposed more broadly than ideal; see Known Issues |
| Synthetic/test data | Development only | `tests/fixtures/` | N/A | Must always be explicitly identifiable as synthetic and must never be treated as historical Selkent data |

---

## 1.1 Selkent standings structure

A real Selkent:

`/public/resultsTable/{division_id}`

response has been inspected.

The confirmed standings columns are:

- Team
- Played
- Won
- Drawn
- Lost
- GF
- GA
- Points

Example team cells contain:

```html
<td
  class="selectTeam"
  data-team-id="458"
  data-division-id="4253"
>
  Athenlay FC
</td>
```

Therefore the planned static-feed representation should preserve:

- `provider_team_id`
- `provider_division_id`
- team name
- played
- won
- drawn
- lost
- goals for
- goals against
- points
- `row_order`

### Important: `row_order` is not `position`

Selkent does **not** expose an explicit Position column.

The sequence of rows can be retained as:

```json
"row_order": 1
```

but must **not** be represented as:

```json
"position": 1
```

Selkent displays the following warning below its table:

> Table does not yet take account of rules for determining winner if teams on equal points.

Therefore:

- row order may be displayed in the same sequence Selkent provides
- row order is not authoritative final ranking for tied teams
- the app must not invent its own tiebreak rules
- GF and GA must not automatically be treated as a goal-difference tiebreak rule
- no alphabetical fallback should be assumed

The static feed should preserve source data, not reinterpret league rules.

---

## 1.2 Selkent provider team IDs

`data-team-id` has been confirmed on:

- `resultsTable/{division_id}`

It has **not** been found on the tested:

- `divisionsspage/{agegroup_id}` responses
- club-detail team lists

Current fixture responses are empty, so whether populated `fixturespage` HTML includes `data-team-id` remains unverified.

The same visible team name can have different `data-team-id` values in different age groups/divisions.

Examples observed:

```text
Athenlay FC
4253 → team-id 458
4281 → team-id 466
4286 → team-id 467
```

and:

```text
Dulwich Village Orange
4245 → 236
4253 → 238
4267 → 266
4286 → 276
4295 → 1042
```

This indicates the ID identifies a specific Selkent team/registration entry rather than the underlying football club.

### Identity rule

`data-team-id` must therefore:

- be stored as an optional `provider_team_id`
- be used where useful for results/standings identity
- potentially be used for fixture/result joins if future fixture HTML confirms the same identifier
- **not** replace the canonical Selkent club ID
- **not** replace club/team linking across all age groups

The club directory remains the source of canonical Selkent club IDs.

---

# 2. Single Source-of-Truth Register

There must be only one authoritative source for each data category.

Parallel acquisition systems may exist for historical, testing or fallback reasons, but they must not silently compete as simultaneous authorities.

---

## 2.1 Selkent club directory and division membership

### Authoritative source

GitHub Actions static pipeline:

```text
scripts/scrape_directory.py
        ↓
data/directory.json
```

Current confirmed coverage:

- all 15 discovered age groups
- full club directory
- division/team membership
- zero unmatched teams on the last confirmed successful run

### Update cadence

Weekly.

### Other systems

Supabase contains older/broader directory infrastructure including:

```text
directory_*
directory-source-acquire
directory-enrich-worker
directory-bootstrap
grassroots-directory
fa-league-discovery
fa-club-import
```

That broader national-directory subsystem is currently:

**DORMANT / REFERENCE ONLY**

It must not be run as a competing source of truth.

---

## 2.2 Selkent fixtures

### Intended authoritative source

GitHub Actions static JSON:

```text
data/results.json
```

### Current state

The existing scraper is still:

```text
AGEGROUP_ID = 3
```

and therefore currently covers only U9.

The fixture parser has only been verified against an **empty** real:

```text
fixtureContainer
```

response.

A populated fixture response has not yet been captured and verified.

### Temporary fallback

The Android app's existing live Selkent fetch path may remain in use for age groups not yet covered by the generalized static pipeline.

Once static coverage is complete and verified, the Android live fetch path for fixtures must be bypassed.

There must not be two simultaneous fixture authorities after migration.

---

## 2.3 Selkent published results

### Intended authoritative source

GitHub Actions static JSON:

```text
data/results.json
```

### Scope

U12 and above only.

U7-U11 results must not be scraped into or published through the public static feed.

### Current state

The existing `results.json` pipeline has not yet been generalized to published U12+ results.

The Android live path therefore remains a temporary source/fallback until static coverage exists.

---

## 2.4 Selkent league standings

### Intended authoritative source

GitHub Actions static JSON:

```text
data/results.json
```

using:

```text
/public/resultsTable/{division_id}
```

### Current verification level

Confirmed against real Selkent HTML:

- table exists
- columns exist
- provider team ID exists
- provider division ID exists
- row order exists
- equal-points disclaimer exists

Not yet validated against a live table containing real non-zero season statistics.

A synthetic non-zero fixture exists for parser development.

This synthetic test proves parser behaviour against expected DOM structure, but does **not** replace validation against real non-zero Selkent data once available.

---

## 2.5 Club-entered U7-U11 results

### Authoritative source

Supabase only.

Relevant paths include:

```text
save_team_state
get_team_state_for_me
```

### Rule

These private results must never be written into:

```text
data/results.json
```

or any other publicly accessible static feed.

---

## 2.6 Player / roster / safeguarding data

### Authoritative source

Supabase only.

GitHub must never become a store for:

- player rosters
- parent/player links
- emergency contacts
- medical information
- allergies
- private match attendance
- safeguarding exports
- safeguarding concerns

---

## 2.7 Existing Supabase Selkent ingestion

A separate Selkent ingestion system exists in Supabase.

Known deployed Edge Functions include:

```text
selkent-directory
selkent-teams-sync
selkent-divisions-sync
selkent-results-sync
selkent-fixtures-sync
```

Known Selkent tables include:

```text
selkent_team_directory
selkent_divisions
selkent_division_teams
selkent_fixtures
selkent_published_results
selkent_published_table_rows
selkent_source_snapshots
```

This system:

- has been built
- has been tested
- contains real Selkent data
- is currently unscheduled
- has no active Selkent cron jobs
- must not operate as a parallel authority to the GitHub Actions pipeline

### Status

**Dormant / retained for possible future repurposing.**

Do not schedule it or integrate the Android app against it without first revising this document and making a new source-of-truth decision.

---

# 3. Update-Frequency Rationale

Each data type must be refreshed according to how often it actually changes.

Do not poll everything at the same frequency by default.

| Data type | Real-world behaviour | Target frequency | Notes |
|---|---|---|---|
| Club/team directory | Rarely changes mid-season | Weekly | Current directory workflow already follows this model |
| Fixtures | Released irregularly, sometimes changed/rescheduled | Daily | A 24-hour discovery window is currently considered sufficient |
| Published results | Usually stable once posted | Daily | No need for hourly weekend scraping unless evidence later shows it is required |
| League standings | Usually changes after published results | Daily | Same collection cycle as U12+ published results |
| Private club-entered results | User action | Immediate write | Not a polling target |
| Player/safeguarding data | User action | Immediate write | Supabase only |

---

## 3.1 Current workflow discrepancy

The current:

```text
.github/workflows/scrape-selkent.yml
```

still contains legacy scheduling including:

```text
hourly on Saturday/Sunday
weekday 18:00 run
daily 07:00 run
```

This does **not** match the target architecture above.

Before the generalized all-age static pipeline is considered finished, the workflow should be simplified so that the production schedule reflects this document.

Current target:

```text
fixtures: daily
results: daily
standings: daily
directory: weekly
```

If real-world observation later shows daily is too slow or unnecessarily frequent, update this document first.

---

# 4. Legal / FA / Safeguarding Constraints

These restrictions override convenience or implementation simplicity.

---

## 4.1 U7-U11 results

FA youth competition rules prohibit public publication of results and league tables for U7-U11.

Selkent already reflects this by not exposing public results tables for those age groups.

Grass Roots Club Hub must independently enforce the same separation.

### Allowed

A club may privately record its own younger-age match information inside its authenticated club environment.

### Not allowed

U7-U11 private results must never appear in:

```text
data/results.json
```

or:

- a public league table
- public club search
- public API/static feed
- public result history
- unauthenticated view

This applies regardless of where the result originally came from.

---

## 4.2 Safeguarding data

Safeguarding data must be limited to appropriately authorized users.

Live review in September 2026 confirmed that the 16 identified U11/safeguarding-related `SECURITY DEFINER` functions all perform an internal authorization or scope check before returning or modifying relevant data.

Checks include combinations of:

- authenticated user
- club membership
- role
- same-club restriction
- own-team restriction
- U7-U11 age validation

Relevant functions include:

```text
export_u11_safeguarding_pack
upsert_u11_safeguarding_info
list_safeguarding_export_audit
set_club_safeguarding_contacts
get_concern_routing
raise_club_concern
get_club_compliance_status
get_team_state_for_me
save_team_state
rollover_club_season
get_club_overview_for_me
get_my_context
list_parent_player_links
save_parent_player_links
list_player_appearance_stats
notify_match_report
```

No missing authorization check has currently been confirmed among those 16 functions.

This does not mean all security hardening is complete; it means those 16 do not currently constitute a confirmed unauthenticated/cross-club safeguarding bypass.

---

# 5. Synthetic and Test Data Rules

Synthetic data is permitted for parser and integration testing, but it must never become indistinguishable from real Selkent data.

---

## 5.1 Naming

All fictional fixtures must use:

```text
SYNTHETIC_
```

at the beginning of the filename.

Example:

```text
tests/fixtures/SYNTHETIC_resultsTable_nonzero.html
```

---

## 5.2 In-file warning

Every synthetic fixture must contain a clear warning inside the file itself stating:

```text
SYNTHETIC TEST FIXTURE — NOT REAL SELKENT DATA
```

A conversation note alone is not sufficient.

---

## 5.3 Synthetic IDs and names

Synthetic records should use obviously fictional:

- team names
- division names
- IDs
- fixtures
- scores
- dates where practical

Examples:

```text
Synthetic Albion
Synthetic Borough
Synthetic City
```

and IDs such as:

```text
900001
990001
```

This reduces the risk that test data is mistaken for a real historical record.

---

## 5.4 Verified vs inferred markup

Test fixtures must distinguish between:

### VERIFIED SHAPE

Markup structure copied from or directly based on observed real Selkent HTML.

### INFERRED SHAPE

Markup invented for development because no real populated response has yet been captured.

This distinction must appear in either:

- filename
- comment
- fixture metadata
- ideally all three

Example:

```text
SYNTHETIC_INFERRED_fixturespage_3.json
```

A parser must not be declared production-verified solely because it passes an inferred synthetic fixture.

---

## 5.5 Current synthetic standings fixture

Current repo fixture:

```text
tests/fixtures/SYNTHETIC_resultsTable_nonzero.html
```

contains fictional non-zero standings using the verified live table structure.

It deliberately includes two teams on equal points to test that:

```text
row_order
```

is preserved without being converted into an authoritative:

```text
position
```

field.

---

# 6. Selkent Identity Strategy

There are multiple identity spaces and they must remain separate.

---

## 6.1 Club identity

Canonical club identity comes from the Selkent club directory.

Example:

```text
/public/clubs/499
```

gives canonical club ID:

```text
499
```

This represents the club.

---

## 6.2 Team identity

Division pages currently expose team names but no verified stable team identifier.

Example:

```html
<div>Athenlay FC</div>
```

Therefore division-team identity cannot currently rely on a provider team ID.

---

## 6.3 Results-table team identity

Results tables expose:

```text
data-team-id
```

This should be retained as:

```text
provider_team_id
```

but it represents the specific Selkent team/registration record associated with that competition entry.

It must not be treated as a club ID.

---

## 6.4 Club/team linking

The current directory pipeline still uses team-name-to-club matching.

That remains acceptable as the current mechanism because no universal team ID has yet been found across:

- division pages
- club detail pages
- mini-soccer ages

However:

- fuzzy/prefix matching should remain observable through diagnostics
- ambiguous matches must never silently become trusted
- if a stable provider mapping becomes available later, this architecture must be updated before replacing the existing linker

---

# 7. Android Integration Rules

The Android app must eventually consume the static GitHub feeds rather than repeatedly scraping Selkent live.

---

## 7.1 Intended final flow

```text
Selkent
   ↓
GitHub Actions scraper
   ↓
static validated JSON
   ↓
Android app
```

The Android client should not become another independent Selkent parser once static coverage is complete.

---

## 7.2 Migration rule

A live Android acquisition path must only be disabled once the replacement static feed covers that same data category adequately.

Current situation:

```text
directory.json
```

covers all Selkent age groups.

But:

```text
results.json
```

is still U9-only.

Therefore the live Android fixtures/results path cannot yet be removed globally.

---

## 7.3 No dual authority

Once a static-feed category is declared complete:

- the static feed becomes authoritative
- the corresponding Android live scrape is bypassed
- old live polling must not later overwrite static-fed state

Fallback behaviour must be explicitly designed, not accidentally inherited.

---

## 7.4 Android transport

The native Android HTTP bridge currently permits only approved Selkent URLs.

The intended static feed host is:

```text
raw.githubusercontent.com
```

for:

```text
michaeljbriggs86-ctrl/Grassroots-Club-Hub
```

When static integration begins, access should be narrowly allowlisted.

Preferred least-privilege approach:

```text
HTTPS only
host = raw.githubusercontent.com
repository = michaeljbriggs86-ctrl/Grassroots-Club-Hub
specific approved static feed paths only
GET only
```

Do not grant unrestricted GitHub Raw access.

Redirect targets should also be validated or redirects handled safely.

Browser `fetch()` should not be relied on as the primary transport workaround because the Android WebView/native bridge security configuration intentionally restricts universal file-origin access.

---

# 8. Publication Safety

The GitHub Actions scraper must prefer stale-but-known-good public data over publishing a corrupted or incomplete snapshot.

---

## 8.1 Directory

If one or more age-group scrapes fail:

```text
do not overwrite directory.json
```

Publish diagnostics instead and retain the previous known-good file.

---

## 8.2 Results / fixtures / standings

The generalized pipeline should adopt the same principle.

A partial failure must not silently erase previously valid data for unaffected age groups/divisions.

Publication should be atomic or merge safely with known-good data.

---

## 8.3 Public/private separation

GitHub static JSON must contain only public Selkent-derived information.

The scraper must never include data originating from:

- Supabase private team state
- parent/player records
- internal U7-U11 results
- safeguarding records
- medical information
- emergency contacts
- private attendance
- private coach notes

---

# 9. Known Open Items

These are not architecture decisions waiting to be rediscovered. They are known unresolved items.

### 9.1 Generalize `results.json`

Current scraper remains U9-only.

Required future coverage:

- all fixture age groups
- U12+ published results
- U12+ standings

---

### 9.2 Capture real populated fixtures HTML

Current live fixture samples are empty.

The populated fixture DOM structure remains unverified.

Do not treat any inferred synthetic fixture structure as production evidence.

---

### 9.3 Validate real non-zero standings

Synthetic non-zero standings are available for parser tests.

Still required:

- verify parser against a real non-zero Selkent table once league results populate
- confirm numeric formatting
- confirm whether any unusual cells occur
- confirm source row ordering behaviour after tied teams appear

Do not convert row ordering into official position.

---

### 9.4 Confirm fixture provider IDs

When real populated fixture HTML becomes available, check whether Selkent exposes:

```text
data-team-id
```

or another stable provider identifier.

If confirmed, update Section 6 before changing identity logic.

---

### 9.5 Simplify scrape schedule

The current `scrape-selkent.yml` still contains legacy hourly/weekend polling.

Target schedule is daily for:

- fixtures
- published results
- standings

---

### 9.6 Club compliance information exposure

`get_club_compliance_status()` currently allows authenticated club members to obtain some information broader than strictly necessary, including reviewer/account and cancellation/deletion metadata.

This is not currently a demonstrated cross-club exploit but should be tightened as defence in depth.

---

### 9.7 Authentication/security advisor follow-up

The Supabase advisor has also identified broader hardening work such as:

- leaked-password protection currently disabled
- RLS-enabled tables with no explicit policies
- authenticated-callable `SECURITY DEFINER` functions

These should be addressed separately from Selkent data architecture.

Do not assume an advisor warning automatically represents an exploit; confirm the actual authorization path first.

---

# 10. Architectural Principles

These rules apply unless this document is formally updated.

1. **One authoritative source per data type.**
2. **Public Selkent data may live in static GitHub JSON.**
3. **Private club/player/safeguarding data stays in Supabase.**
4. **U7-U11 public results remain prohibited.**
5. **Do not invent provider identifiers or ranking logic.**
6. **Preserve Selkent source ordering without claiming it is an official tied-team position.**
7. **Dynamic discovery is preferred over hardcoded age-group IDs.**
8. **Synthetic test data must always remain unmistakably synthetic.**
9. **Incomplete scrapes must not destroy known-good published data.**
10. **Do not operate GitHub, Supabase and Android live scraping as three competing authorities.**
11. **Do not replace a working source until the replacement has matching coverage.**
12. **Update this document before code whenever reality and architecture diverge.**

---

# Changelog

## 2026-09-18 / 2026-09-19 — Initial architecture register

Created after discovery of:

- an U9-only GitHub results/fixtures scraper
- a separate dormant Supabase Selkent ingestion system
- an Android live Selkent acquisition path
- a public/private conflict surrounding U7-U11 results

Established the single-source-of-truth principle.

---

## 2026-09-19 — Directory vs league-table correction

Corrected the earlier assumption that:

```text
data/directory.json
```

contained league standings.

Verified that it contains:

- clubs
- divisions
- team membership
- team-to-club links

but not:

- played
- won
- drawn
- lost
- GF
- GA
- points

Real standings data was subsequently confirmed on:

```text
/public/resultsTable/{division_id}
```

---

## 2026-09-19 — Standings endpoint confirmed

Confirmed real Selkent results-table HTML exposes:

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

Also confirmed:

- `data-team-id`
- `data-division-id`
- tied-team disclaimer

No explicit Position column is present.

The architecture therefore uses:

```text
row_order
```

rather than:

```text
position
```

The displayed sequence may be preserved but must not be presented as an authoritative tied-team ranking.

---

## 2026-09-19 — Provider team ID investigation

Confirmed that `data-team-id` appears on:

```text
resultsTable/{division_id}
```

but was not found on tested:

```text
divisionsspage/{agegroup_id}
club detail team lists
```

Populated fixtures remain unverified.

The same visible team name can carry different provider team IDs across age groups/divisions.

Decision:

- retain as optional `provider_team_id`
- do not use as canonical club ID
- do not replace the existing cross-age club/team linker with it

---

## 2026-09-19 — Synthetic test fixture policy

Added:

```text
tests/fixtures/SYNTHETIC_resultsTable_nonzero.html
```

for parser testing.

The fixture:

- contains explicit in-file synthetic warnings
- uses fictional teams and IDs
- contains non-zero statistics
- includes two teams tied on points
- tests `row_order` behaviour
- must never be mistaken for historical Selkent data

Established the rule that all future fictional fixtures use a:

```text
SYNTHETIC_
```

prefix and explicit in-file warnings.

---

## 2026-09-19 — Current migration state

Confirmed:

- `data/directory.json` is full Selkent directory coverage
- `data/results.json` remains U9-only
- Supabase Selkent ingestion exists but is unscheduled/dormant
- Android live Selkent fetching remains temporarily necessary for uncovered data
- GitHub static feeds remain the intended app-facing source of truth once generalized

No Android static-feed cutover should occur until the relevant static feed has equivalent coverage and has passed validation.

**Status:** Living document. This is not written once and filed away — see
Revision Protocol below. Read this before any conversation that touches data
scope, data source, data privacy, or update frequency.

---

## 0. Revision Protocol (read this first)

This document must be revised **immediately**, before continuing any other
work, whenever any of the following happens:

- A conflict is discovered between what this document says and what's
  actually true (a system doing something the doc doesn't mention, a
  privacy/access assumption that turns out wrong, a scope decision that
  contradicts an earlier one).
- A new data type, system, or integration is proposed that isn't already
  covered in Section 1 or Section 2.
- A legal/FA/compliance rule is discovered that affects scope, access, or
  storage (see Section 4) and isn't already listed.
- An update-frequency assumption in Section 3 turns out to be wrong in
  practice (too slow, too frequent, or the data behaves differently than
  assumed).

**When a conflict is found:** stop, update this document to reflect the
correction, then resume. Do not patch the code first and update the
document later "once things settle" — that's how the three-parallel-Selkent-
systems problem happened. The document is the thing both Mike and any AI
working on this app check *before* building, not a record kept *after*.

Every entry below should be dated when it's added or changed, so drift is
visible.

---

## 1. Data Classification

For every category of data, this section states: what it is, who can see it,
where it's allowed to live, and which age groups it applies to.

| Data type | Visibility | Where it lives | Age scope | Notes |
|---|---|---|---|---|
| Selkent divisions / club-team directory | Public | GitHub static JSON (`data/directory.json`) | All ages | Team membership per division (division name + team list), NOT standings/points/W-D-L. **Confirmed 2026-09-19**: real standings data (Played/Won/Drawn/Lost/GF/GA/Points) exists on a separate Selkent endpoint (`resultsTable/{division_id}`), not in the data directory.json currently scrapes from. Standings will belong in the generalized results.json, not here |
| Selkent fixtures | Public | GitHub static JSON (`data/results.json`, to be generalized) | All ages | Publicly available on Selkent's own site regardless of age. **Currently U9-only** — not yet generalized to all age groups |
| Selkent published results and standings (table) | Public | GitHub static JSON (`data/results.json`, to be generalized) | **U12 and up only** | Selkent's own site does not publish results for U7–U11 (FA rule, see Section 4). Nothing to scrape for younger ages — this is not a scraping gap, the data doesn't exist externally. **Currently U9-only, not yet generalized or split by U12+ scope**. **Standings parser is UNTESTED against real numbers as of 2026-09-19** — the season had not started when this was checked, so every captured row was all-zero. This confirms the column structure exists and parses, but not that real multi-digit numbers, tiebreak ordering (position is currently assumed = row order, unverified), or non-numeric cells (e.g. a dash for an unplayed fixture) are handled correctly. **Do not mark this feature as working, and do not let the app depend on it, until spot-checked against at least one round of real, non-zero Selkent results** |
| Club-entered results for U7–U11 teams | **Private — club only** | Supabase (`save_team_state` / `get_team_state_for_me`, existing RLS + role checks) | U7–U11 only | Clubs may log results internally for their own use; must never appear in any public file or public-facing view |
| Team rosters / player data | Private — club/coach/parent scoped | Supabase | All ages | Existing `can_read_team` / `can_edit_team` checks apply |
| U7–U11 safeguarding info | Private — admin/staff, own club, own team only | Supabase (`upsert_u11_safeguarding_info`, `export_u11_safeguarding_pack`) | U7–U11 only | Confirmed (Sept 2026) all related functions have real authorization checks |
| Club compliance/welfare contacts | Club members (currently broader than ideal) | Supabase (`get_club_compliance_status`) | All | **Known issue**: reviewer IDs and cancellation metadata currently visible to all authenticated club members, not just admins. Flagged for tightening, not yet fixed as of last check |

*(Add new rows here as new data types appear. Do not let a new data type go
into code before it has a row here.)*

---

## 2. Single Source-of-Truth Register

One line per data type: which system is authoritative, which are dormant,
and why.

| Data type | Authoritative system | Other systems that exist | Status of others |
|---|---|---|---|
| Selkent fixtures/results/divisions | GitHub Actions static JSON (`data/results.json`, `data/directory.json`) | (1) Android app's live `syncSelkent()`/`fetchSelkentSelected()` fetch path; (2) Supabase Selkent ingestion (`selkent-teams-sync`, `selkent-results-sync`, etc., with populated tables) | (1) To be bypassed once static feed covers all needed age groups — **as of last check, results.json is U9-only, so live fetch is still needed as fallback for other ages until generalized**. (2) Built, tested, has real data, but **unscheduled and not to be run in parallel** — kept dormant rather than retired, pending a future decision on repurposing |
| Club-entered private results (U7–U11) | Supabase (`save_team_state`) | None currently | N/A |
| Team/roster/safeguarding data | Supabase | None currently | N/A |

**Rule:** if a new system is proposed that could produce or store a data
type already listed here, that's a Section 0 conflict — stop and resolve
which system is authoritative before building.

---

## 3. Update-Frequency Rationale

Not "poll everything on the same schedule by default" — each data type's
frequency should reflect how often it actually changes.

| Data type | How often it actually changes | Current/planned polling frequency | Rationale |
|---|---|---|---|
| Selkent league tables | Rarely — once posted, typically stable | Daily (down from earlier hourly-weekend assumption) | Confirmed by Mike (Sept 2026): tables "typically stand once posted" |
| Selkent published results (U12+) | Rarely — once posted, typically stable | Daily | Same as above |
| Selkent fixtures | Occasionally — released irregularly, single/small batches, ~1 week's notice; can also be rescheduled | Daily | Frequent enough to catch a release/reschedule within 24h without hammering Selkent's server across ~15 age groups |
| Club/team directory (Selkent) | Very rarely — barely changes mid-season | Weekly | Confirmed working as of Sept 2026 run (15/15 age groups, 0 unmatched teams) |
| Club-entered private results | On demand (whenever a club logs one) | N/A — not polled, written directly via app action | Not a scrape target |

**Rule:** if a frequency assumption above turns out wrong in practice (data
changes faster or slower than expected), that's a Section 0 conflict —
update this table, then adjust the actual schedule to match.

---

## 4. Legal / FA Constraints (standing checklist)

Check this section before any scope decision, not after.

- **FA SCORY Rule C4(A)(iii):** results and league tables must not be
  published for U7–U11 age groups. Selkent's own site already complies
  (no results endpoint exists below U11). The app must independently
  enforce the same restriction for any results a club chooses to log
  privately for U7–U11 — those must never surface in a public-facing view
  or public data file, regardless of source.
- **Safeguarding data (all ages, but especially U7–U11):** access must be
  scoped to authenticated staff/admin, same club, generally own-team only.
  Confirmed (Sept 2026) via direct review of live function definitions —
  see Section 1 safeguarding row.
- *(Add new legal/compliance constraints here as they're identified —
  don't let one get discovered mid-build again.)*

---

## Changelog

- **2026-09-18/19:** Initial version created, following discovery of (a) the
  U9-only scope of the fixtures/results scraper, (b) a second dormant
  Selkent ingestion system in Supabase nobody had cross-checked against the
  GitHub Actions pipeline, and (c) a public/private data conflict between
  "Selkent league fully accessible" and "club results private to the club."
- **2026-09-19:** Correction applied following Section 0 conflict caught by
  ChatGPT on first read: Section 1 previously described `data/directory.json`
  as holding "league tables," but it only contains division/team-membership
  data (division name + team list), no standings/points/W-D-L. Split the
  "Selkent divisions / league tables" row into "divisions / club-team
  directory" (accurate, matches directory.json) and flagged an open question
  on whether Selkent exposes standings data anywhere at all — unconfirmed as
  of this entry. Also made explicit in Section 1 (not just Section 2) that
  results.json is still U9-only, not yet generalized.
- **2026-09-19 (later same day):** Open question above answered — ChatGPT
  confirmed real standings data (Played/Won/Drawn/Lost/GF/GA/Points) exists
  via Selkent's `resultsTable/{division_id}` endpoint, separate from the
  division/team-list data directory.json currently scrapes. Standings belong
  in the future generalized results.json. **However**: every row checked so
  far is all-zero because the season hadn't started yet at time of checking.
  This confirms the column structure exists, not that the parser handles
  real (non-zero, multi-digit) numbers, unplayed-fixture cells, or tiebreak
  ordering correctly — position is currently assumed to equal row order,
  which is unverified. **Explicit trigger**: revisit and spot-check the
  standings parser against at least one round of real, non-zero Selkent
  results once the season starts, before treating this feature as working
  or letting the app depend on it.
