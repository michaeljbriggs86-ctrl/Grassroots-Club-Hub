# Individual profile screens — 11 October 2026

Requested: tap a person's name to open a separate screen, keep details
relevant to the person's role, and reduce clutter on the main pages.

## Navigation and lists

The app adds a dedicated Person details screen at view=person. Contact,
team-access, pending-parent, coaching-staff and admin-account names are
keyboard-accessible buttons. Player names in Squad, the season statistics
table and parents' own child lists open the same screen with player details.
My profile / My coaching profile opens the signed-in account's own screen.
The coach-document matrix remains on Staff, including expiry warnings and
filters; tapping a matrix name opens that person's profile.

Main people lists now show names, roles and team labels. Contact email/phone,
edit forms, linked-child details, access-method information and management
actions move into the individual screen. The spreadsheet import remains on
Contact details, collapsed behind its own summary. The old player-profile
dialog is replaced by the screen; existing player-edit and qualification-edit
dialogs remain as focused editing tools.

Browser Back/Forward uses an opaque in-memory selection key. No person ID,
name or contact values are placed in the URL or history state. Authentication
callback fragments and unrelated query parameters are retained. Reloading
an old profile URL asks the user to select a name again. Back to list returns
to the originating list, with a safe home/club fallback when no selection
exists. No new sidebar or primary navigation tab is added.

## Relevant details and access

| Person | Details shown where authorised |
| --- | --- |
| Coach / Assistant Coach | Role, team assignments and email/phone; qualifications and recorded dates for Club Admin or the staff member; admin management actions |
| Club Admin | Club role, available team context and email/phone; own/admin-visible coaching qualification records |
| Parent | Role, email/phone, linked players for the current team; appropriate staff link/PIN/access actions |
| Pending parent | Supplied child name and email, pending status and existing request-review workflow; staff only |
| Player | Shirt, playing role, permitted personal statistics, and availability for the linked parent/player; coach editing action |

Parents cannot open other parents or unlinked players, even through a
forged button or an accidentally over-broad contact response. Parents see
coaches for the currently selected child team and never request their private
qualification data. Coach/assistant parent contacts stay within the current
assigned team. Club Admin uses club-scoped account endpoints. Staff using
Parent capacity follows parent restrictions. U7–U11 parent/player screens
exclude goals, assists, goal contributions and results; staff can see their
existing coaching information. Ambiguous roster names are not arbitrarily
selected. Player app-login age restrictions are unchanged: a roster detail
screen does not create a player login.

Every profile re-reads an existing authorised endpoint before rendering.
Names in cached lists are not permission grants. Profile data is cleared
when leaving, changing team/role/club/account or logging out. Context includes
the session/profile match and the cloud instance. Late replies and stale
profile targets cannot repopulate another screen or capacity. Availability
buttons are delegated after dynamic rendering and only write for the
validated linked player and current fixture. Permission-checked existing
save/edit/remove APIs remain in use; successful edits refresh the screen.

## Integration and validation

Integrated main 6a016d504b3ab7d462a03451ac7b0f8bff2e01ad, preserving the
new coach-document matrix, expiry notices and latest fixture-card updates.
The static allowlist and both service workers include person-profiles.js
and advance their cache versions. CI compares its built/source bytes.

- All 100 JavaScript suites passed, including fresh-source authorisation,
  parent/team/child privacy, private qualifications, mini-age statistics,
  unavailable APIs, dynamic availability, safe content, profile clearing,
  history keys, late responses and matrix-to-profile navigation.
- All 91 navigation cases across seven role/capacity modes passed. Parent
  navigation permits the Person screen; its subject resolver still controls
  which individual can be opened.
- 191 UI source checks and 133 Python regressions passed. Existing UI checks
  were updated to find pending identity and coach controls on the new screen.
- Browser build, pilot scope, badge quality, syntax, source/build byte
  comparisons and diff checks passed.

No database schema, RPC grants, real contacts or other private member records
were changed by this work. The existing contact/import/qualification drafts
retain their approval requirements. Profile sections report unavailable
data when their backend is not enabled, without broad fallback endpoints.
No live deployment or signed-in phone acceptance is claimed.

Phone review: open names in each list; use Back/Forward; try role/team changes;
verify parent coaching-contact and own-child screens; check coach qualification
dates and admin edit dialogs; confirm no restricted records or addresses;
review long names and text enlargement in both themes.

## PR85 conflict resolution — 12 October 2026

Merged main b8a075f6a3b1eba0f8ed8a9cf72c4e5f8afda52f, preserving the
compact-clean UI from PR87, the updated Selkent Cup handling and current
public feeds. The only conflicts were the two service-worker cache
versions. Both now use `pitchkind-web-person-profiles-compact-20261012`
and retain `person-profiles.js` in their static cache lists. Individual
screens, role/team privacy guards, the qualification matrix and the latest
layout are preserved. No contact permissions or database SQL changed.

The combined tree passed all 100 JavaScript suites, 138 Python regressions,
191 UI source checks, syntax checks, badge quality, pilot scope, browser
build, source/build byte comparisons and diff checks. No live deployment,
PR merge or database application was performed for this resolution.
