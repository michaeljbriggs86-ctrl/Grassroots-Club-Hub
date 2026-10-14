# ANSWERED: Kick-off updates implementation and launch gate

To: Mike / Claude
Date: 14 October 2026, 12:22 Europe/London
Status: WRITTEN, TESTED, BUILT locally. NOT LIVE. No real push notifications or emails sent.

Design source: https://www.figma.com/design/NY8QhcuOWiEcD0pKDTsbP8?node-id=285-6351
Passing pre-implementation review: LOG-ENTRY_2026-10-14_1157_chatgpt_kickoff-push-seen-design-review.md (new Drive inbox entry). Final copy says sent, because external service acceptance is distinct from device delivery or seen confirmation.

Implementation includes native seen checkbox and explicit server-confirmed receipt; per-version reset/stale-write rejection; approved team audience including all assigned coaches/assistant coaches and linked parents; private Supabase events/subscriptions/receipts/outbox; committed save trigger; device opt-in and logout unsubscribe; generic lock-screen push; public-fixture branded email; an authenticated scheduled dispatcher with bounded retries and expiring claims; aggregate staff confirmation and delivery counts. Provisional kick-offs stay provisional. No historical backfill, player audience or private-child information in external messages.

Evidence on 14 October:
- 110 existing client checks pass, 191 source verification checks pass, 31 Cloudflare worker tests pass.
- Throwaway PGlite/Postgres tests pass: committed-only events/rollback, identical save idempotence, valid times, latest revision, fresh confirmation, permission grants, RLS, parent receipt privacy, multiteam coaches, device ownership, revocation, delivery leases/retry, withdrawn-time protection, Vault schedule prerequisite and no secret in cron SQL.
- 6 transport logic/encryption tests and 3 confirmed-save/failure/team-switch tests pass.
- Deno check passes for the real dispatcher; real Deno entrypoint runs against fake localhost PostgREST, rejects user JWTs, claims empty queue using service RPC, and sends nothing externally. npm audit for pinned test/transport dependencies reports no vulnerabilities.
- Built Chromium flow passes in dark/light, at 320/393/1024px, for Coach and Parent: opening never acknowledges, checkbox required, failed write keeps selection without success, seen state only after server response, changed details require new confirmation, parent has no family totals, push enable/disable/logout and empty state. Existing notification browser regression passes in both themes and phone/wider including Admin destination.
- Directly inspected built screenshots of small-phone parent and coach receipt cards and changed-time confirmation. Corrected checkbox alignment to match the reviewed horizontal layout, then reran browser verification.
- Integrated current main commit 6630c18181d80136a0fda506fa16f57416cafe59 to preserve the concurrent assigned/provisional weekend infographic change.

Live gate (current ARCHITECTURE.md §2.10 says: “Live database application requires Mike's explicit written instruction naming each change.”):
1. Named migration 20261014105830_kickoff_updates.sql: private event/receipt/subscription/outbox tables, guarded adult and service RPCs, committed fixture trigger. Disabled transport flags by default.
2. Provision matching VAPID keys, club-approved verified SMTP sender/service on TLS port 465, and dispatcher token in Edge Function secrets. No applicable SMTP/VAPID/dispatcher Vault secret names were present in metadata. Do not expose secrets in source/chat. The Supabase connector has no secret-provisioning capability; explicit approval for the authenticated Supabase dashboard fallback is needed for that setup.
3. Deploy kickoff-dispatch (custom bearer authentication, verify_jwt=false) and put the matching dispatcher token in Vault as kickoff_dispatch_token.
4. Named migration 20261014111626_kickoff_dispatch_schedule.sql: private guarded invocation and once-per-minute cron job, no literal token in cron text. Refuses absent Vault token.
5. Verify with an explicitly authorised test account/device, then enable both transports via configure_kickoff_delivery. Do not activate unrelated pending migrations or send to the whole club as a test.

Limits: sent means external service accepted, not device/human delivery. SMTP retry after a crash can rarely duplicate a message despite stable Message-ID. Browser Web Push requires supported secure browser/PWA and user permission; native WebViews without Push API remain unavailable. Devices have a 30-day renewable subscription lease. No live transport, sender/domain or scheduled execution claim; independent verification remains Claude's responsibility.
