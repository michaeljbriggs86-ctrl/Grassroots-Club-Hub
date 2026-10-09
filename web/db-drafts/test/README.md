# claim_invite local test (throwaway Postgres, NOT Supabase)

`00_stub_schema.sql` builds minimal stand-in tables. `01_claim_invite_original.sql` is the live function copied on 2026-10-09. `../002_claim_invite_proposed_fix.sql` is the proposed fix (NOT applied). `03_cases.sql` runs six invite cases against whichever version is loaded.

Result on 2026-10-10 (Postgres 16): the original maps player and unknown invites to role `coach`; the fix gives `player` (U15 only), refuses player invites for other ages and refuses unknown roles. Coach, assistant coach and parent behaviour is identical.

Limits: no RLS, no real auth schema, no triggers, no other functions. It proves the function logic only. Review against the real schema before applying.

Update 2026-10-10: Mike approved the fix with U15 players waiting for coach approval (`pending_player`). APPLIED to the live database as migration `claim_invite_player_pending_and_reject_unknown_roles`. Rollback: run `01_claim_invite_original.sql`, which is a reformatted but logically identical copy of the previous live function (the exact original text was not saved byte for byte).
