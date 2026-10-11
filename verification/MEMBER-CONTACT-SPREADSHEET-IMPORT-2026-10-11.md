# Spreadsheet contact import — 11 October 2026

The club will compile contact details in a spreadsheet. Club Admin imports
them in bulk through Inbox → Contact details → Import contacts from a
spreadsheet. Individual forms remain available for later corrections.

## Spreadsheet contract

Export Excel or Google Sheets as comma-separated CSV (UTF-8). Native XLSX
and a continuously synchronised Google Sheet are not supported by this
initial framework. Download member template emits one row per approved
account with user_id, full_name, email and phone columns. It does not export
existing email/phone values. Keep phone cells as text to retain leading zeroes.

| Column | Meaning |
| --- | --- |
| user_id | Stable account ID from the template; preferred match |
| full_name | Required if user_id absent; if supplied alongside an ID, must match |
| team | Optional exact team-name filter for name matching |
| role | Optional club_admin, coach, assistant_coach or parent match filter |
| email | Contact email, separate from sign-in email |
| phone | Contact phone as text |

The file must contain user_id or full_name and email or phone headers.
Unknown columns, including addresses, are rejected. A blank email or phone
preserves the current value; [CLEAR] deliberately clears that field. Rows
with both contact fields blank are skipped. Members omitted from the file
keep their details. A file can contain at most 500 rows and 1 MB. The parser
handles BOM, CRLF, quoted commas, quoted newlines and escaped quotes.

## Review and import

Preview matches against a fresh club-wide list of approved adult accounts,
even when the directory's team filter is selected. Duplicate names are
never chosen arbitrarily: use the template ID or an unambiguous team/role.
Duplicate account rows, unmatched members and invalid fields block the
whole batch. Preview shows each matched member's proposed values and
explicit keep/clear actions. It performs no writes. A separate Import
contacts button submits the validated batch as one database transaction.

The import does not create accounts, invite parents, approve members or
change names, team membership or permissions. Reimport after the appropriate
account has been approved if a spreadsheet row cannot yet be matched.

The import UI, file reference, data and pending preview are cleared on
directory refresh/close, team/capacity/account changes and logout. Late
responses cannot repopulate another account. No sheet is uploaded or
persisted in browser storage, static feeds or service-worker caches.
Only matched member IDs and changed contact fields are sent to the RPC.
Downloaded template names escape spreadsheet formula prefixes.

## Database draft

`web/db-drafts/019_member_contact_import.sql` is an additive companion to
`019_member_contact_details.sql`; both are DRAFT / NOT APPLIED by this work.
It requires the existing 012/015/019 functions. No existing draft is renumbered
or rewritten. Live application still requires Mike's explicit instruction
naming the database changes, as specified in Architecture.

Public `import_member_contact_details(jsonb)` is a SECURITY INVOKER wrapper
bound to an unexposed private function, without granting authenticated users
private schema USAGE. The private function locks and verifies the current
profile's effective Club Admin role. It rejects invalid JSON/types, extra
keys, missing fields, duplicate IDs and oversized batches. It calls the
existing permission-checked contact saver for every target, preserving
omitted fields under the shared profile lock. An invalid, revoked or
cross-club target raises and rolls back all rows. An admin acting in parent
capacity cannot import. Anonymous callers have no execute grant.

Existing directory access stays the same: parents see their team's coaches
and no other parents, coaches/assistants see assigned-team parents, and
Club Admin sees approved adults within their own club. No addresses.

## Verification

- All 98 JavaScript suites and 191 UI source checks passed.
- Local throwaway PostgreSQL ran the existing contact privacy tests and the
  new atomic import tests using pinned PGlite 0.3.14. It checked blank
  preservation, explicit clearing, invalid-batch rollback, duplicate IDs,
  data types, size limits, cross-club/revoked/non-admin denial, parent
  capacity, grants and the closed private schema. All synthetic rows rolled
  back. No live connection or real contact data was used.
- Browser build, pilot scope, badge quality, syntax and diff checks passed.
  Built index/app/cloud/CSS/coach/importer assets matched source bytes.
- The existing UI regression workflow now also runs the PostgreSQL tests
  and checks byte equality for both the coach and importer scripts.

Phone acceptance after review: download template, compile/export a CSV,
preview ambiguous and invalid rows, verify blank/clear semantics and batch
results, then test parent/coach/admin access. No live acceptance claimed.
