# ANSWERED: Kick-off push, email and seen confirmation design review

To: Mike / Claude
Date: 14 October 2026, 11:57 Europe/London
Status: DESIGN REVIEW PASSED for the implementation scope below. No delivery or live claim.

Source: Mike's requests in this conversation: send notifications and email when kick-off times are added; device push required; coaches and parents need confirmation they have seen the update. Current master ARCHITECTURE.md, BRAND-GUIDELINES.md, APP-UI-DESIGN-GUIDELINES.md and AI-COLLABORATION-PROTOCOL.md fetched on 14 October. Repository AGENTS.md read. No historical handoff claims relied on.

Editable Figma board: https://www.figma.com/design/NY8QhcuOWiEcD0pKDTsbP8?node-id=285-6351
Pending checkbox pair: node 285:6352. Seen: 285:6393. Changed details: 285:6424. Failure: 285:6465. Device push on/off/blocked/unavailable: 285:6508, 285:6545, 285:6582, 285:6611. Staff confirmations: 285:6640. Wider: 285:6683. Branded email and privacy-preserving push: 285:6714. Loading/push error/pending access/empty/saving/stale confirmation: 286:6396, 286:6425, 286:6454, 286:6483, 286:6514, 286:6557.

Evidence: inspected rendered dark/light 320px device settings, 393px acknowledgement, wider layout, email and push, plus editable structure. Existing semantic theme variables, unchanged approved badge, existing action instances and auto-layout are reused. Fixed primary actions to approved green and long status text to content-driven reflow; inspected final stale-details render without overlap. Body 14px+, action 52px, checkbox row 44px+. No zero-width text. Long screens scroll in implementation.

Reviewed scope:
- Atomic server event on successfully committed additions/changes of a valid upcoming kick-off time, public venue or provisional/confirmed status. Repeated identical saves do not generate another version. Local edits and failed saves do not send. No historical backfill.
- Team-scoped approved coaches/assistant coaches (all assigned teams), admin's coaching team, and linked approved parents including staff with parent links. No player audience or unrelated-club audience.
- Device push, email and in-app update; push requires explicit device permission/subscription. Configurations missing, blocked permissions and unsupported devices must say unavailable. No fabricated sent status. Delivery acceptance is separate from acknowledgement.
- A native checkbox labelled “I’ve seen these details” and “Confirm seen” action. Only server-confirmed acknowledgement shows “Seen by you”. Read/open is separate. New detail version requires a new acknowledgement; stale writes fail and refresh. One account cannot acknowledge for another.
- Relevant staff can see aggregate coach/parent seen totals and channel status. Parents see their own confirmation, no other family identities. Data resides in Supabase, with private RLS and guarded RPCs.
- Push/email open Notifications in the signed-in app; no acknowledgement on GET or notification click. Lock-screen content generic. Email uses public fixture fields and approved club identity, no private child information.
- Log-out removes this device's account subscription; private content never goes into service-worker cache.

Unresolved design issues: none in this scope. Runtime dependencies: no existing Web Push worker/VAPID configuration or transactional fixture email transport found. Build/test the implementation and delivery worker without real recipients; provision the transport and apply only explicitly named live database changes under ARCHITECTURE section 2.10 before claiming live delivery.

Independent verification remains Claude's role; this is ChatGPT's design and implementation review, not independent acceptance.
