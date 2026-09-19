# Grassroots Club Hub — Data Architecture Reference

**Status:** Living governing document  
**Last updated:** 2026-09-19

This document is the source of truth for:

- data scope
- data sources
- public vs private data
- Selkent integration
- update frequency
- identity/linking strategy
- Android data acquisition
- safeguarding/compliance boundaries
- synthetic/test data
- migration/cutover rules

Read this document before making changes to any of those areas.

---

# 0. Revision Protocol

Revise this document **before implementation work continues** whenever:

- the document conflicts with the real system
- a new data type, source, integration, parser or storage path is proposed
- a source-of-truth decision changes
- a privacy/access assumption changes
- an identifier believed to be stable proves otherwise
- a legal/FA/safeguarding rule changes scope, access or storage
- an update-frequency assumption proves wrong
- synthetic/test data starts being used for a new purpose

If a conflict is found:

1. Stop.
2. Update this document.
3. Resume implementation.

This exists specifically to prevent GitHub, Supabase and Android from silently becoming competing Selkent authorities.

---

# 1. Data Classification

| Data type | Visibility | Authoritative storage | Age scope | Current state |
|---|---|---|---|---|
| Selkent club directory | Public | `data/directory.json` | All | Live |
| Selkent division/team membership | Public | `data/directory.json` | All | Live |
| Selkent fixtures | Public | `data/results.json` | All | Feed generalized to all ages; populated fixture markup still unverified |
| Selkent published match results | Public | `data/results.json` once populated-result parser is verified | U12+ only | Discovery works; non-empty result markup still unverified |
| Selkent league standings | Public | `data/results.json` | U12+ only | Live in schema v2 |
| Club-entered U7-U11 results | Private, club scoped | Supabase | U7-U11 | Live; must never enter public GitHub JSON |
| Team rosters/player data | Private | Supabase | All | Live |
| U7-U11 safeguarding information | Highly restricted private data | Supabase | U7-U11 | Live |
| Safeguarding export audit | Restricted private data | Supabase | U7-U11 | Live |
| Club safeguarding/compliance data | Club scoped | Supabase | All | Live; some defence-in-depth tightening remains |
| Synthetic/test data | Development only | `tests/fixtures/` | N/A | Must always be unmistakably synthetic |

---

## 1.1 Public Selkent feed

The generalized public feed is:

```text
data/results.json
```

Current schema:

```text
schema_version = 2
provider = Selkent
```

The first successful generalized production run completed on:

```text
2026-09-19
```

and published:

```text
15 age groups
54 standings divisions
320 standings rows
0 parsed fixtures
```

At that run:

- all 20 parser/integration tests passed
- all live fixture endpoints returned empty fixture containers
- all live published-result panels were empty
- standings rows were structurally valid but still all-zero
- no `position` field was produced

The scraper fails closed if it encounters populated fixture/result markup that has not yet been verified.

---

# 2. Single Source-of-Truth Register

There must be only one authoritative source per data category.

Parallel systems may exist temporarily during migration, but must not silently overwrite one another.

---

## 2.1 Club directory and division membership

Authoritative path:

```text
Selkent
  ↓
scripts/scrape_directory.py
  ↓
data/directory.json
```

Coverage:

- all discovered Selkent age groups
- club directory
- division/team membership
- team-to-club links

Update cadence:

```text
weekly
```

The older national/directory infrastructure retained in Supabase is dormant/reference-only and must not become a competing authority without revising this document first.

---

## 2.2 League standings

Authoritative path:

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

Scope:

```text
U12+
```

Current status:

```text
STATIC GITHUB FEED IS AUTHORITATIVE
```

The Android app must not independently reinterpret or recalculate league standings.

---

## 2.3 Fixtures

Intended authoritative path:

```text
Selkent
  ↓
scripts/scrape.py
  ↓
data/results.json
```

Scope:

```text
all ages
```

Current limitation:

- empty `fixtureContainer` shape is verified
- no real populated fixture HTML has yet been captured
- populated fixture parsing is therefore not production-verified

Until that markup is captured and verified:

- the static feed remains the intended final authority
- Android live Selkent fixture acquisition may remain as a **temporary migration fallback**
- the fallback must never overwrite static standings state
- once populated fixture parsing is verified, remove/bypass the live Android fixture path

---

## 2.4 Published match results

Intended authoritative path:

```text
Selkent
  ↓
scripts/scrape.py
  ↓
data/results.json
```

Scope:

```text
U12+
```

Current limitation:

- Results age-group discovery is verified
- division discovery is verified
- empty result panels are verified
- no real populated result-row HTML has yet been captured

Until a real populated result sample is captured and parsed:

- Android live published-result acquisition may remain as a temporary migration fallback
- U7-U11 must never be included
- no guessed result DOM parser may be shipped as production logic

---

## 2.5 Club-entered U7-U11 results

Authoritative source:

```text
Supabase
```

Relevant paths include:

```text
save_team_state
get_team_state_for_me
```

These results are private club data and must never be written to:

```text
data/results.json
```

or any unauthenticated/public view.

---

## 2.6 Player, roster and safeguarding data

Authoritative source:

```text
Supabase only
```

GitHub static data must never contain:

- player rosters
- parent/player links
- emergency contacts
- medical information
- allergies
- private attendance
- safeguarding concerns
- safeguarding exports
- private coach notes

---

## 2.7 Dormant Supabase Selkent ingestion

A separate Selkent ingestion system exists in Supabase, including:

```text
selkent-directory
selkent-teams-sync
selkent-divisions-sync
selkent-results-sync
selkent-fixtures-sync
```

and tables including:

```text
selkent_team_directory
selkent_divisions
selkent_division_teams
selkent_fixtures
selkent_published_results
selkent_published_table_rows
selkent_source_snapshots
```

Status:

```text
DORMANT / UNSCHEDULED
```

It must not be enabled as a competing production authority without revising this document first.

Historical snapshots may still be used for investigation/verification.

---

# 3. Selkent Standings Contract

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

Verified team-cell attributes include:

```html
<td
  class="selectTeam"
  data-team-id="458"
  data-division-id="4253"
>
  Athenlay FC
</td>
```

Static rows preserve:

- `row_order`
- `provider_team_id`
- team name
- played
- won
- drawn
- lost
- GF
- GA
- points

Top-level standings data preserves:

- `provider_division_id`
- division name
- update text where available
- source disclaimer
- `source_order_authoritative_for_ties = false`

---

## 3.1 `row_order` is not `position`

Selkent does not expose an explicit Position column.

The displayed sequence may be retained as:

```json
"row_order": 1
```

but must never be converted to:

```json
"position": 1
```

The captured real Selkent payload uses the wording: “Note: Table does not yet take account of rules for determining winner if teams on equal points.”

Therefore:

- preserve source order
- do not invent tiebreak rules
- do not calculate official position
- do not assume goal difference is the tiebreak
- do not use alphabetical fallback

---

## 3.2 Non-zero validation state

Synthetic non-zero testing exists and passes.

Real production tables had:

```text
320 rows
0 non-zero rows
```

on the first generalized production run.

Therefore:

- parser structure is production-verified against real zero-data tables
- non-zero parser behaviour is test-verified synthetically
- a real non-zero standings sample must still be spot-checked once one appears
- this is a validation task, not a reason to recreate or bypass the static standings feed

---

# 4. Provider Identity Rules

There are separate identity spaces.

---

## 4.1 Club identity

Canonical Selkent club identity comes from the public club directory:

```text
/public/clubs/{id}
```

This is the canonical provider club ID.

---

## 4.2 Results-table team identity

`data-team-id` exists on results-table rows.

It is stored as:

```text
provider_team_id
```

It is **not** a club ID.

The same visible team name can have different provider team IDs in different age groups/divisions.

Therefore `provider_team_id` must not replace canonical club identity or the cross-age club/team linker.

---

## 4.3 Fixture provider identity

Whether populated fixture HTML exposes `data-team-id` or another stable identifier remains unverified.

Do not change identity logic until a real populated fixture response is captured.

---

## 4.4 Internal club-team identity

The private `public.teams` table must not use mutable display/import labels as the logical identity of a team.

A duplicate-team fault was confirmed on 2026-09-19. Repeated directory synchronisations created additional active rows for the same club team because the client supplied changing `selkent_label` values containing UUID-like suffixes while the database conflict target was `(club_id, selkent_label)`.

For one season, the logical identity is:

```text
club_id + season + age_group + normalized team display name
```

Rules:

- `selkent_label` is display/import metadata, not a stable identity key.
- Repeated directory syncs update the existing logical team rather than insert another row.
- A division change must not create a new team record.
- Duplicate cleanup preserves the canonical/oldest team record and any linked state, profiles, invitations, attendance, notes, safeguarding data, or audit history.
- The database enforces the logical identity for active teams with `teams_active_logical_identity_key`.
- `sync_team_directory` resolves teams by logical identity and strips the unstable UUID-like suffix previously appended to `selkent_label`.
- Provider IDs may be stored when available but must not be invented for age groups/endpoints that do not expose them.

---

# 5. Update Frequencies

| Data type | Production frequency |
|---|---|
| Club/team directory | Weekly |
| Fixtures | Daily |
| Published U12+ results | Daily |
| U12+ standings | Daily |
| Private club-entered results | Immediate user action |
| Player/safeguarding data | Immediate user action |

Current production Selkent workflow:

```text
.github/workflows/scrape-selkent.yml
```

runs:

```text
07:00 UTC daily
```

and executes parser tests before publication.

Legacy hourly weekend polling has been removed.

---

# 6. Publication Safety

The public pipeline must prefer stale known-good data over a corrupt or incomplete replacement.

For `data/results.json`:

- collection happens before publication
- publication is atomic
- an unverified populated fixture/result payload causes the run to fail closed
- the existing published file remains untouched if collection/parsing fails
- private Supabase data must never be merged into this public file

For `data/directory.json`:

- any failed age-group scrape prevents replacement of the known-good directory

---

# 7. Legal / FA / Safeguarding Constraints

U7-U11 public results and league tables must not be published.

Grassroots Club Hub therefore enforces:

```text
public Selkent results/standings: U12+
private club-entered results: U7-U11 allowed inside authenticated club scope
```

Private younger-age results must never appear in:

- `data/results.json`
- public result history
- public league tables
- public club search
- unauthenticated views

Safeguarding data remains Supabase-only and access-controlled.

Any future legal/FA rule change affecting this model requires a Section 0 architecture update before code changes.

---

# 8. Synthetic/Test Data Rules

All fictional fixtures/data must:

- use a filename beginning `SYNTHETIC_`
- contain an explicit warning that the data is not real Selkent data
- use obviously fictional names/IDs
- state whether the markup is verified or inferred

Required warning:

```text
SYNTHETIC TEST FIXTURE — NOT REAL SELKENT DATA
```

Current standings fixture:

```text
tests/fixtures/SYNTHETIC_resultsTable_nonzero.html
```

uses fictional non-zero statistics and intentionally includes tied teams.

Synthetic parser success does not replace real production verification.

---

# 9. Android Integration Rules

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

The Android app should not become another long-term Selkent parser.

---

## 9.1 Static-feed URLs

Approved public feed host:

```text
raw.githubusercontent.com
```

Approved repository:

```text
michaeljbriggs86-ctrl/Grassroots-Club-Hub
```

Approved production paths:

```text
/main/data/directory.json
/main/data/results.json
```

Native Android access must use least privilege:

- HTTPS only
- exact host
- exact repository
- exact approved paths
- GET only
- safe redirect handling/validation

Do not grant unrestricted access to arbitrary GitHub Raw URLs.

---

## 9.2 Static-feed migration state

### Directory

```text
STATIC FEED AUTHORITATIVE
```

Android should use `data/directory.json`.

### Standings

```text
STATIC FEED AUTHORITATIVE
```

Android should use `data/results.json`.

### Fixtures

```text
MIGRATION INCOMPLETE
```

Static feed discovers every age group but only the empty fixture shape is verified.

Temporary Android live fallback may remain until a real populated fixture response is captured and its parser is verified.

### Published results

```text
MIGRATION INCOMPLETE
```

Temporary Android live fallback may remain until a real populated result sample is captured and parsed.

---

## 9.3 No dual-authority overwrite

During migration:

- static directory data must not be overwritten by live Android directory scraping
- static standings must not be overwritten by live Android standings parsing
- temporary fixture/result fallback must remain isolated to those categories
- once fixture/result static parsing becomes verified, corresponding live acquisition must be removed/bypassed

Existing periodic live sync timers must not later overwrite static-fed state after cutover.

---

## 9.4 Android static-feed parsing

Android/WebView code should treat schema v2 explicitly.

Required behaviour:

- verify `schema_version`
- reject malformed JSON
- retain last known-good app state if a feed read fails
- treat `standings: null` as "not publicly published", not as an error
- treat empty `fixtures: []` with `fixture_parse_status: verified_empty` as valid
- never infer U7-U11 public standings/results
- display standings in source `row_order`
- never label `row_order` as official position

---

# 10. Current Production State

As of the first generalized production run on 2026-09-19:

```text
data/results.json
schema_version: 2
provider: Selkent
age groups: 15
standings divisions: 54
standings rows: 320
fixtures: 0
non-zero standings rows: 0
```

Age groups with public standings coverage:

```text
U12
U12X
U13
U14
U14X
U15
U16
U17
Senior
```

Age groups intentionally without public standings/results:

```text
U8
U8X
U9
U10
U10X
U11
```

All 20 automated tests passed immediately before the first production publication.

---

# 11. Known Open Items

## 11.1 Capture a populated fixture response

When a real populated fixture payload appears:

- capture the real HTML
- confirm team/date/venue markup
- check provider IDs
- add a verified fixture
- implement and test parser
- then remove Android fixture live fallback

---

## 11.2 Capture a populated published-result response

When a real U12+ result appears:

- capture the real HTML
- confirm team/score/date/competition structure
- add a verified fixture
- implement and test parser
- then remove Android published-result live fallback

---

## 11.3 Validate real non-zero standings

When a real non-zero standings table appears:

- spot-check numeric parsing
- verify unusual values if present
- verify source row order
- retain the no-position/no-invented-tiebreak rule

---

## 11.4 Android static-feed integration

Next implementation task:

- allowlist exact GitHub Raw feed paths in the native bridge
- add dedicated static JSON fetch path
- load `directory.json` and schema-v2 `results.json`
- make static directory/standings authoritative
- keep fixture/result live fallback isolated temporarily
- prevent old polling from overwriting static-fed state

---

## 11.5 Club compliance information exposure

`get_club_compliance_status()` exposes some reviewer/account and cancellation/deletion metadata more broadly than ideal to authenticated club members.

No confirmed cross-club exploit is known, but this should be tightened as defence in depth.

---

## 11.6 Wider security hardening

Known follow-up items include:

- Supabase leaked-password protection disabled
- RLS-enabled tables with no explicit policies
- large number of authenticated-callable `SECURITY DEFINER` functions

These require separate review.

Do not interpret an advisor warning as proof of an exploit without checking the actual authorization path.

---

## 11.7 Duplicate internal club-team records — resolved

Confirmed and repaired on 2026-09-19.

Migration `fix_duplicate_team_identity`:

- preserved the original/canonical team rows
- verified non-canonical duplicates had no linked data before deletion
- removed 45 empty duplicate rows
- reduced Shooters Hill from 60 physical team rows to 15 logical team rows
- changed `sync_team_directory` to resolve by the stable logical identity from Section 4.4
- added `teams_active_logical_identity_key`
- left linked team state, history, invitations, notes, attendance, parent links and profiles intact

Post-migration verification found zero duplicate logical groups.

---

# 12. Architectural Principles

1. One authoritative source per data type.
2. Public Selkent data may live in static GitHub JSON.
3. Private club/player/safeguarding data stays in Supabase.
4. U7-U11 public results/standings remain excluded.
5. Do not invent provider identifiers.
6. Do not invent league positions or tiebreak rules.
7. Dynamic provider discovery is preferred to hardcoded age IDs.
8. Synthetic data must remain unmistakably synthetic.
9. Failed scrapes must not destroy known-good public data.
10. GitHub, Supabase and Android must not become simultaneous competing authorities.
11. Do not remove a migration fallback until replacement coverage is verified.
12. Update this document before code whenever architecture and reality diverge.

---

# Changelog

## 2026-09-18 / 2026-09-19 — Initial architecture register

Created after discovery of:

- U9-only GitHub results/fixture scraping
- dormant parallel Selkent ingestion in Supabase
- Android live Selkent acquisition
- public/private U7-U11 result separation requirements

Established the single-source-of-truth rule.

---

## 2026-09-19 — Directory/standings correction

Confirmed `data/directory.json` contains:

- clubs
- divisions
- team membership
- team-to-club links

but not standings.

Confirmed standings exist at:

```text
/public/resultsTable/{division_id}
```

---

## 2026-09-19 — Standings contract confirmed

Confirmed:

- Team
- Played
- Won
- Drawn
- Lost
- GF
- GA
- Points
- `data-team-id`
- `data-division-id`
- tied-team disclaimer

Adopted `row_order`, explicitly not `position`.

---

## 2026-09-19 — Provider team-ID decision

Confirmed provider team IDs vary for the same visible team name across competition entries.

Decision:

- retain optional `provider_team_id`
- do not use as canonical club ID
- do not replace cross-age club/team linking

---

## 2026-09-19 — Synthetic standings fixture

Added:

```text
tests/fixtures/SYNTHETIC_resultsTable_nonzero.html
```

with fictional non-zero values and tied teams.

---

## 2026-09-19 — Generalized public feed deployed

`data/results.json` was generalized and successfully published in production.

First production run:

```text
15 age groups
54 standings divisions
320 standings rows
0 fixtures
0 non-zero standings rows
20/20 tests passed
```

The scraper now:

- dynamically discovers fixture age groups
- dynamically discovers public Results age groups/divisions
- publishes U12+ standings
- excludes U7-U11 public results/standings
- fails closed on unverified populated fixture/result markup
- publishes atomically

The production workflow was simplified to one daily 07:00 UTC run.

---

## 2026-09-19 — Android migration boundary updated

Static GitHub feeds are now authoritative for:

```text
directory
standings
```

Temporary Android live fallback remains permitted only for:

```text
fixtures
published results
```

until real populated provider markup is captured and verified.

---

## 2026-09-19 — Internal club-team identity correction

Confirmed a live duplicate-team fault in `public.teams`: repeated directory syncs created new rows because changing `selkent_label` values were being treated as identity.

Defined the stable logical identity for one season as:

```text
club_id + season + age_group + normalized team display name
```

Also recorded the requirement to preserve linked data during cleanup and add a database uniqueness guard.

---

## 2026-09-19 — Duplicate team migration applied

Applied Supabase migration:

```text
fix_duplicate_team_identity
```

The migration removed 45 empty duplicate team rows after first proving that all non-canonical duplicates had no linked references.

Post-migration state:

```text
Shooters Hill physical team rows: 15
Duplicate logical groups: 0
```

Existing linked data counts were preserved, including team state/history, invitations, coach notes, attendance, parent-player links and profiles.

A unique active-team logical-identity index now prevents the same duplication pattern recurring.

---

## 2026-09-19 — Standings disclaimer verification

Checked the complete captured real `resultsTable/4253` payload, not only a team-cell snippet.

Confirmed the real structure contains:

- `panel panel-static`
- `panel-heading`
- `pull-right` updated timestamp
- `<thead>`
- `<tbody>`
- the exact eight standings headers
- `selectTeam` cells with provider team/division IDs

The captured disclaimer says teams are “on equal points”. The parser's existing `equal points` fragment therefore matches the real captured source; future parser hardening may still match the stable note prefix rather than relying on the final wording.

---

## 2026-09-19 — Architecture cleanup

Removed duplicated legacy sections that still described:

- `results.json` as U9-only
- the old hourly/weekend scrape schedule
- standings `position` assumptions that had already been superseded

This document is now the single current architecture reference.
