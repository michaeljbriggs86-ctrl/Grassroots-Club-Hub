# viewer_age_privacy_fail_closed

**TESTED CANDIDATE — NOT APPLIED LIVE.** Architecture section 2.10 requires Mike's explicit written approval naming each live database change. Publishing this source does not apply the SQL.

Candidate: `supabase/migrations/20261017134139_viewer_age_privacy_fail_closed.sql`.

Current live `team_player_age` resolves unknown/null ages to 0. The viewer projection previously sanitized only ages 7–11, so unknown/below-seven parent/player reads could retain score fields with a false `restricted` flag. Fictional records reproduced that behavior using the current live function definitions; no claim is made that any current child's records were exposed.

The candidate changes exactly three existing function definitions:

- `private.state_for_viewer(jsonb,uuid,uuid,text,integer)`: normalize null/below-seven effective age to 7 for the existing nonstaff projection. The original-age staff branch and its private identity hydration remain unchanged.
- `public.get_team_state_for_me(uuid)`: mark effective parent/player reads restricted for unknown age or any resolved age <=11.
- `public.get_my_context()`: apply the same flag, preserving its current `can_read_team(target)` check and all other current behavior.

One atomic statement verifies exact catalog-definition hashes before replacing anything. A changed function aborts the candidate. Function signatures, owners, OIDs, ACLs, configuration, pure public sanitizer semantics, existing U12+ parent results, own-child filtering and application rows are preserved. There are no table, policy, grant, contact, qualification or player-eligibility changes.

Run the isolated regression after installing pinned `@electric-sql/pglite@0.3.14` outside the checkout:

```sh
node web/db-drafts/test/run-viewer-age-privacy.cjs /path/to/node_modules/@electric-sql/pglite
```

The observed-contract fixture contains current read-only function definitions, not business data. The runner proves the original defect, tests unknown/below-seven/U7–U11/U12+/X-label projections and both RPC flags, compares all staff outputs before/after, checks own-child/pending/unlinked/cross-club/anonymous boundaries, preserves metadata and rows, and rejects each stale-function guard atomically. Initial result: **334 isolated PostgreSQL checks passed**.

These tests use fictional schema/auth stand-ins. They do not establish production JWT validation, all RLS behavior, real-user acceptance or application of the candidate. Before any approved live application, independently review this exact SQL and freshly compare all three catalog hashes. Re-read the three definitions/attributes after application and verify the age projection with invented values only.
