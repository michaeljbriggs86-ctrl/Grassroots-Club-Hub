# Player Access backend — NOT DEPLOYED

**Status (2026-09-19): WRITTEN.** This folder is intentionally separate from the historical backend reference files and must not be described as live.

The v2.2.4 client now expects `POST /functions/v1/player-access`.

## Intended behaviour

- Adult users continue through normal Supabase email/password authentication.
- Player access remains **U15 only** under the current architecture/product rule.
- An authorised Club Admin, Coach or Assistant Coach can generate/rotate a reusable code for a named player.
- The player signs in with **Player Name + Player Code**. No player email address or phone number is requested.
- The raw reusable code is returned to the adult once; only a peppered SHA-256 hash is stored.
- The server uses a synthetic, non-contact Supabase Auth identity so existing authenticated/RLS application paths can continue to operate.

## Files

- `20260919_player_access_credentials.sql` — new server-only credential table and RLS/grant boundary.
- `player-access/index.ts` — Edge Function source for `issue` and `login`.

## Required deployment secret

Create a high-entropy `PLAYER_LOGIN_PEPPER` project secret before deploying the function. It must never be shipped in the Android app or committed to source.

## Deployment sequence (not performed here)

1. Review the migration and Edge Function against the current live backend.
2. Apply the SQL migration.
3. Set `PLAYER_LOGIN_PEPPER` as a Supabase project secret.
4. Deploy the `player-access` Edge Function.
5. Exercise issue/login/rotation/invalid-code/U15-denial tests against the running function.
6. Only after those checks may the backend be called DEPLOYED-LIVE.
