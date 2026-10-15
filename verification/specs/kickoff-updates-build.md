# Kick-off update candidate — 15 October continuation

Status: refreshed against current main; isolated verification in progress. Not a production or independent acceptance claim.

The original 14 October build/launch record is retained unchanged in Drive 97 LOG INBOX as LOG-ENTRY_2026-10-14_1222_chatgpt_kickoff-updates-tested-launch-gate.md. Current Figma re-review and delivery adaptation are recorded in LOG-ENTRY_2026-10-15_1646_chatgpt_priority3-kickoff-continuation-review.md.

The current implementation reuses the existing native club email service, generates the stable VAPID pair inside the authenticated Edge runtime, and stores it in Vault without displaying/exporting the private key. Its two candidate migrations remain kickoff_updates and kickoff_dispatch_schedule. The original SMTP/dashboard provisioning dependency has been superseded by this bounded server-only path. No other database candidate is authorised by this work.

Verified locally: committed-only event/version/receipt isolation; literal push vendor boundaries; active/verified/unbanned pilot audience; UK-local future date/time guards; one-use/expired/revoked email lease rejection; service-only key bootstrap and rotation prevention; no historical send on activation; native email receipt/error behaviour; real Deno bearer/configuration/bootstrap/empty-queue boundaries. Existing main features, the public registration portal and its privacy response headers are preserved.

Final CI, actual built screenshots, deployed source/catalog/HTTP evidence and any open device/inbox acceptance are recorded in a new immutable release entry after verification. This candidate document does not itself establish deployment.
