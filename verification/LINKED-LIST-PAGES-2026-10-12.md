# Dedicated list pages — 12 October 2026

Long lists now have their own screens, with real entry/Back links and role-gated query routes:

- Contacts (including the existing CSV import framework)
- Club teams
- Coach document matrix
- Club app access
- Staff access requests
- Team access
- Rules and procedures
- Season history
- Audit history
- Raise an issue

Club Home retains weekend readiness, staff request/coverage counts, document renewal/missing-record warnings, communications counts and a team count. Fixture previews, unassigned-team previews, the document matrix and full team directory no longer occupy Home. Requests and all app access no longer extend the coaching staff list. Messages retain links to Contacts and Raise an issue.

Individual names still open the existing role-relevant profile screen. The parent access-mode guard now allows the individual profile route, matching the navigation guard. Contact directory loading is tied to the Contacts screen; leaving clears the directory/import preview and rejects late replies. No new backend APIs, schema changes or permissions are introduced. Existing role/team contact privacy and unavailable-backend handling are retained.

## Validation

- 101 JavaScript regression suites passed.
- 161 screen/profile routes passed across coach, assistant, parent, player, club admin, admin coach and admin team preview.
- 191 existing UI verification assertions passed.
- New HTML topology verification: one copy of each panel, all ten lists on the correct destination screen, entry/Back links, focusable headings and retained Home warnings.
- Real Chromium app verification with synthetic cloud responses and every network request intercepted: actual links, all ten routes, parent opening a coach profile and returning to Contacts, forbidden routes/capacity changes, no JavaScript errors, no horizontal spill at 360/390/768/1280px.
- Browser build, source/dist equality, official badge quality and pilot scope checks passed. Service worker cache versions updated together.

Reproduce the browser check with `python verification/verify_linked_pages_browser.py` after installing Python Playwright and its Chromium binary. It uses synthetic accounts only and suppresses automatic app startup so the harness can exercise production navigation/rendering directly. It does not test a signed-in live deployment or apply SQL.
