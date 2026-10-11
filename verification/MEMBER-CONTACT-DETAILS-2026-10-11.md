# Member contact framework — 11 October 2026

Status: TESTED source and local browser bundle. SQL 019 is a DRAFT and has NOT
been applied to Supabase. No real contacts were read, imported or updated.
Signed-in browser/phone acceptance and independent review remain open.

## Product behavior

Contact details is a collapsible panel under Inbox (Communications for Club
Admin). Approved adults can update their own contact email and phone. This is
separate from their sign-in email. Club Admin can enter/update details for
approved club members and filter the directory by team. Missing details have
explicit empty states. Email and phone links support contacting a member.
No postal address field, bulk export, public contact feed or offline contact
cache is added. Member names come from the existing approved account profile.

| Acting role | Directory visibility | Editing |
| --- | --- | --- |
| Parent | Staff assigned to the active linked child's team | Own contact only |
| Coach / Assistant Coach | Staff and approved linked parents within an assigned team | Own contact only |
| Club Admin | All approved adults in their own club, including unassigned accounts | Own and other approved club contacts |
| Staff in Parent view | Same restriction as Parent; own child's team, no parent directory | Own contact only |
| Player, pending, revoked, anonymous | No contact API access | None |

Parent links and staff assignments use existing authoritative tables and
same-club/active-team checks. SQL supports every assigned or linked team;
the frontend passes the currently selected team. No messaging, approval or
team-edit permission is changed. A staff member linked as a parent appears in
that parent's team only to permitted staff/admin viewers; a parent viewer
receives staff projections only, without other children's names.

## Backend review

`web/db-drafts/019_member_contact_details.sql` requires applied 012 and 015.
Contact rows reside in `private.member_contact_details`, with RLS enabled and
no browser table grants/policies. The two public SQL-standard invoker wrappers
bind references at definition time to the unexposed private checked functions.
Authenticated users receive only execute privileges on these four routines;
the existing denial of private schema USAGE remains unchanged. Anonymous and
PUBLIC execution is revoked. Every privileged implementation checks auth.uid,
the current profile/effective role, club and target membership. Write requests
permit self or effective Club Admin only, reject unapproved/cross-club targets,
validate email/phone and permit clearing fields. Revoked contacts disappear
from directory reads even when historic links still exist.

This draft is intentionally unnumbered in migration history. Do not apply it
merely because the app PR is merged. Governing Drive ARCHITECTURE.md states:
“Live database application requires Mike's explicit written instruction naming
each change.” Database change 019 must be explicitly approved, then applied,
verified against real schema/function definitions and checked with advisors.

## Validation

- 96 JavaScript regression suites passed, including contact views/editing,
  escaping/links, selected-team filters, missing backend, late responses,
  capacity/team/account changes and immediate contact clearing during switches.
- 191 governing UI source checks and 130 Python tests passed.
- SQL executed using PostgreSQL in PGlite 0.3.14 with a throwaway local schema
  matching the inspected live columns. Role/team/club/write/capacity/revocation,
  invalid fields, direct table denial, closed private schema and anonymous API
  assertions passed. Fixture transaction rolled back; zero contact rows remain.
  No synthetic DDL or fixture was run on live Supabase.
- Syntax, badge quality, pilot scope, website build and diff checks passed.
- Actual built index.html/app.js/cloud.js/app-design-system.css bytes exactly
  matched the tested source. SQL/tests/docs are excluded from the website
  allowlist. Both cache versions advance to team-contacts-20261011.

Original PR browser build SHA-256 (before the main-branch integration below):

| File | SHA-256 |
| --- | --- |
| index.html | fddbd631e33200d66c90a504cf408b7f2187db32305b106f2dde908651c8d2a0 |
| app.js | de6ca118b264c7347f9a70fe527512f6bfc892654de4b30d7c4cfa0825318ba7 |
| cloud.js | da4bdbe6b4d4400f8dff9b06320a5b33e551e18caa18377ebb4a80d980ff7e50 |
| app-design-system.css | 204ed3f0af7f4f94ef7efd2f44caac37a5f1f424a0791a61a594141098689d37 |

## Acceptance after approval

Check parent, coach, assistant and admin sessions in light/dark modes and at
phone widths/enlarged text. Verify selected-team switching, parent capacity,
club filtering, missing data, email/phone actions, self/admin saves and inline
errors. Attempt other-parent/off-team/cross-club calls with authenticated
sessions. Confirm no contacts remain after logout or in browser storage/cache.
Until the backend is applied the panel reports contacts unavailable without
falling back to a broader member endpoint. No live acceptance is claimed.

## PR80 conflict resolution — 11 October 2026

Integrated main 95a80eaa954f2f47cc4dd3c52dbc1e2d496273d7, including merged
coach qualifications PR79 and the approved badge batch. The only merge
conflicts were the two service workers' cache definitions. Both now use
`pitchkind-web-contacts-coach-documents-20261011` and retain the new
`coach-qualifications.js` static asset. No contact SQL or permission rule was
changed by this integration.

All 97 JavaScript suites and 191 UI source checks passed on the combined tree.
Python regressions, badge quality, pilot scope, browser build, source/build
byte comparisons and diff checks also passed. No live SQL or deployment was
performed. The combined browser bundle hashes are:

| File | SHA-256 |
| --- | --- |
| index.html | 558570b7c4b9b712bf41790debb3595b0c24c360383c01c42eacfb1f7b8adf7d |
| app.js | 9a0798ebd2a9e9a96858e4f62c398d03c9eb15772f5b604edb1a3282fdeb7cfe |
| cloud.js | c8b7593c2df50e817f24e2dff26a3c79c2af3a21b9fa2a3cb376f0cdb2c1c22d |
| app-design-system.css | d1b306c4b3df016166f01d9fe10b7c75acc536bdfd93584be47c34af2b29a4f3 |
| coach-qualifications.js | 33123bedc3ef0efc2e2eb3e72b24f5dd3fe8b9933e807ec2330c265e40d5faf2 |
