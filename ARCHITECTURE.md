# Grass Roots Club App — Data Architecture Reference

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
| Selkent divisions / league tables | Public | GitHub static JSON (`data/directory.json`) | All ages | Selkent publishes this itself; safe to mirror publicly |
| Selkent fixtures | Public | GitHub static JSON (`data/results.json`, to be generalized) | All ages | Publicly available on Selkent's own site regardless of age |
| Selkent published results | Public | GitHub static JSON | **U12 and up only** | Selkent's own site does not publish results for U7–U11 (FA rule, see Section 4). Nothing to scrape for younger ages — this is not a scraping gap, the data doesn't exist externally |
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
