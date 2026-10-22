# Project instructions for all coding agents

## Standing authorisation to publish requested app changes

Mike confirmed on 22 October 2026: "No approval needed. Update the architect document and guidelines to reflect this."

For requested PitchKind / Shooters Hill AFC app work, implement the change, complete the applicable Figma review and relevant tests/build checks, commit, push directly to `main`, and deploy to the existing live website without asking for separate commit/push/deploy approval. Preserve concurrent commits and inspect the actual running artifact before claiming LIVE status. The current friendly kick-off and venue fix is included in this authorisation.

This standing permission covers publication within the requested scope. Existing product/design departure, generated-image approval and independent-verification requirements still apply. Tool-enforced permissions cannot be changed by project documentation; report any actual tool rejection accurately and never bypass it. Record decisions/evidence in a new Drive `97 - LOG INBOX` file; never edit existing log entries, the index or frozen history.

## Required Figma review before feature implementation

Mike's instruction, 13 October 2026: "Ensure that any new features are subject to Figma review before implementation."

Before implementing a new feature, new screen, or new user-visible workflow/action:

1. Read the current PitchKind project guidance in Google Drive, using only the PitchKind folder. Preserve the established architecture and role/privacy boundaries.
2. Create or update its editable Figma design in the existing Shooters Hill AFC file: https://www.figma.com/design/NY8QhcuOWiEcD0pKDTsbP8 . A general styling pass does not cover a new workflow.
3. Review the actual Figma artifact before writing implementation code. Inspect rendered layouts and editable structure; check both themes, phone and applicable wider layouts, clear actions, readable contrast, touch targets, reflow and navigation. Cover applicable loading, empty, validation, error, success, pending/unapproved and unsaved-change states. For backend features, review their user-visible flow and permission/status effects before implementing the feature.
4. Record the dated result, source/spec reference, exact Figma node links, evidence and unresolved issues in a NEW entry in Drive's `97 - LOG INBOX`. The review must pass for the proposed implementation scope; unresolved design issues remain a blocker. Never overwrite the master log, history or existing entries.
5. Implement only the reviewed scope. If implementation introduces another field, action, state, permission effect or materially different layout, update and review Figma first.
6. Test the implementation against that design, then directly inspect the built/running artifact before claiming it is built or live. Preserve the independent verification duties in AI-COLLABORATION-PROTOCOL.md.

This is a required design check, not an additional blanket user-confirmation step. Proceed autonomously within Mike's authorized scope once the design review passes. Existing requirements for approving departures from the governing design or product direction still apply.

Use Shooters Hill AFC for visible club identity and the supplied approved badge unchanged. Use fictional data in design/review examples; no real child records. Preserve team-scoped contacts, no member addresses, parents seeing only their own child's permitted information, and U15-only player access. Preserve the three coach-document categories: Enhanced DBS, safeguarding and first aid. Figma layouts do not confer permissions or establish backend enforcement.

Read-only investigation and fixes that merely restore existing reviewed behaviour do not become new features. If a fix changes the user-visible flow, review that change in Figma before implementation.

## Current design work

The October 13 Admin people/onboarding review is in the same Figma file. It is design work; its existence is not proof of live implementation or independent acceptance. Read its dated review entry before using it as implementation authority.
