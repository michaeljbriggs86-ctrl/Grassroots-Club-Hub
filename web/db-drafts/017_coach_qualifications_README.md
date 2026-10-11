# Draft 017 — coach qualification profiles

**Not applied. Requires Mike's explicit `Apply 017`, independent database review, and frontend phone acceptance before claiming live availability.** The 11 October 08:40 shared handoff requires explicit approval for live SQL. The UI gracefully reports unavailable while the RPCs are absent.

This adds metadata to staff profiles, without altering profile roles, team assignments or approvals. Club Admins in staff capacity edit same-club staff records. Coaches/assistants read only their own records. Parent capacity, parents, players, pending accounts, anonymous callers and other clubs cannot access them. Pure Club Admins can also hold a record, without the app assuming they are youth coaches.

## Requirements researched on 11 October 2026

| Record | Date tracking | Primary source |
| --- | --- | --- |
| FA-accepted Enhanced DBS with Children's Barred List | Disclosure issue and FA renewal due. FA requires an accepted disclosure issued within the last three years for eligible roles aged 16+; this is an FA renewal period, not a legal expiry of a DBS certificate. | [FA safer recruitment / DBS](https://www.thefa.com/football-rules-governance/safeguarding/section-3-safer-recruitment-and-dbs-checks) |
| Safeguarding Children / recertification | Completed and expires; current FA course validity is two years. | [FA Safeguarding Children course](https://learn.englandfootball.com/courses/safeguarding/safeguarding-children-course) |
| Introduction to First Aid in Football (IFAiF) | Completed and expires; three years. EFAiF and other first-aid records use their actual recorded expiry; no date is inferred for those alternatives. | [FA IFAiF course](https://learn.englandfootball.com/courses/medical/introduction-to-first-aid-in-football) |

Scope confirmed by Mike: track only Enhanced DBS, safeguarding and first aid. Coaching awards and UEFA licences are excluded from both the profile and the accepted database categories. Confirm role requirements and exact dates/FA acceptance in Club Portal; this app does not make an automated eligibility decision.

Renewal suggestions are editable calendar anniversaries, with leap days clamped to February's last day. They are not verification. Changing a date/course clears the editor's club-check checkbox. Dates are interpreted using London today. Expiry today is shown as due today; dates before today are expired (DBS: renewal overdue). The 60-day due-soon window is an app reminder threshold, not an FA rule. Missing entries and unchecked records are distinct. No automated eligibility blocks or reminders are added.

## Storage / RPC design

Private tables hold one collection per club/staff member and a private change audit. There are no public table grants or authenticated/anon grants on private tables/helpers; RLS is enabled as defense in depth. Public get/save RPCs revoke PUBLIC/anon execution and allow authenticated execution only. Security-definer functions are necessary for access to protected profiles and private storage; they fix the search path to empty and validate the database profile, effective capacity, target role and club each time.

Accepted fields are kind, a fixed course code, completed_on, expires_on and club_checked. Arbitrary keys, duplicate kinds, wrong course/category combinations, invalid/future completion dates and missing required renewal dates are rejected. No certificate files/numbers, criminal-record details, FAN IDs or free-text notes are accepted. Server-generated check attribution is never accepted from the client. The app does not cache qualification data in local/team storage or publish it through static feeds/service-worker caches.

Only a same-club Club Admin can confirm a club check. For DBS, the checkbox specifically means FA acceptance and dates checked in Club Portal. The app has no automatic FA verification connection. Unchanged verified records keep their original checker/time; changed records checked again are attributed to the current admin. Removing one record submits the remaining collection after in-app confirmation; private audit records keep the prior metadata.

An expected revision prevents silent overwrites, and a target-profile row lock serialises both inserts and updates. A conflict tells the admin to close/reopen before retrying. Closed dialogs, session/club/mode changes and newer reads cannot commit stale UI responses. A request already submitted may complete after closing; it remains addressed to the original, server-authorised target.

## Local database verification

`test/017_coach_qualifications_rollback_test.sql` runs in an **empty throwaway PostgreSQL database**, refuses an existing profiles table, creates synthetic roles/profile/club stubs and rolls all changes back. The effective-capacity stub reproduces the live helper logic (staff Parent view requires a linked child). There are no real accounts or credentials.

Run with PGlite **0.3.14**:

```sh
node web/db-drafts/test/run-coach-qualifications.cjs /absolute/path/to/node_modules/@electric-sql/pglite
```

The runner inlines the draft, executes the rolled-back assertions and checks that the private table no longer exists. Coverage: RPC/private grants, RLS enabled, same-club writes, self-only staff reads, parent/player/pending/unknown/anonymous denial, parent-capacity denial, invalid fields/dates/course combinations, duplicate types, expired historical records, rejected coaching/UEFA categories and expiry required for all three document types, stale revision, server verification attribution, removal and audit. It proves local function logic and grants against stand-ins; it is not a live migration or a Supabase integration test. Current live columns and helper/list functions were inspected read-only before drafting.

The frontend suite `tests/test_coach_qualifications.js` executes the production module and actual cloud wrappers, covering London/leap dates, expiry boundaries, validation, admin/self-only routing, cancellation, duplicate submits, revisions, failures and stale contexts. The browser build explicitly includes the new script; database drafts remain outside its asset allow-list.

`017_rollback.sql` is a destructive rollback draft that deletes these metadata/audit tables. It requires separate explicit approval and a protected backup once real records exist. It has not been applied.
