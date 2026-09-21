# AI Collaboration Protocol — Grassroots Club Hub

**Status:** Living document, same revision discipline as ARCHITECTURE.md.

This governs how any AI system (currently ChatGPT and Claude) working on
this project behaves — not what the system does technically (that's
ARCHITECTURE.md), but how claims get made, checked, and reconciled when
two independent AIs are both touching the same codebase, database, and
file store.

This exists because, in one evening, this project accumulated: three
independent Selkent data systems nobody had cross-checked against each
other; an architecture document that stated a feature was live in
production when the shipped APK never contained it; a security decision
described as "approved" in one document and "needs a deliberate review"
in another, both apparently accurate at time of writing; and source code
committed as an unreadable base64 blob inside a CI file. None of these
were caused by bad intent — they happened because two systems kept
working in parallel without a shared way to state and check what was
actually true.

---

## 1. Status vocabulary — use these words precisely

A claim about any feature, integration, or fix must use one of these
words, and only when it's actually true:

- **PLANNED** — described, not built. No code exists yet.
- **WRITTEN** — code exists, has not been run against real data or a
  real build.
- **TESTED** — run against real or synthetic data in isolation (unit
  tests, manual parser checks). Not yet part of a real build/deployment.
- **BUILT** — included in an actual build artifact (an APK, a deployed
  Edge Function) — confirmed by inspecting that artifact, not by
  inspecting the source that was supposed to produce it.
- **DEPLOYED / LIVE** — running in the environment real users hit.

**Never use "done," "complete," "working," or "live" without one of the
words above attached.** "The static feed integration is done" is not a
valid status. "The static feed integration is WRITTEN and TESTED, not
yet BUILT" is.

If a document says BUILT or DEPLOYED, that claim must be checked against
the actual artifact (the APK, the running function) before being
trusted — not inferred from the source code or workflow file that was
*supposed* to produce it. Tonight's static-feed gap existed specifically
because "the workflow that patches this exists" was treated as
equivalent to "this is in the shipped app," and they were not the same
claim.

---

## 2. One canonical copy per document

`00 - CURRENT MASTER` (or the repo's equivalent) holds the single current
version of any status-bearing document (ARCHITECTURE.md, this file,
integration checklists). If a second copy of a planning document exists
elsewhere (a TODO file, a chat-pasted summary), it is either:

- explicitly marked as superseded, with a pointer to the current version, or
- deleted once its content has been merged into the canonical copy.

Two documents making different claims about the same fact (e.g., whether
a security review happened) is itself a conflict under ARCHITECTURE.md
Section 0 and must be resolved — not left as two plausible-sounding
answers for whoever reads which file first.

---

## 3. Before building, check what already exists

Before adding a new data pipeline, sync system, scraper, or storage path:
check the Single Source-of-Truth Register in ARCHITECTURE.md Section 2.
If the thing you're about to build might already exist in another form
(a dormant Supabase system, an old script, a different AI's earlier
work), that's not a fact to discover after building — it's a check to
run before.

---

## 4. Source code is committed as source code

No source file (Java, JS, Python, SQL) is ever embedded as base64, or
any other encoded/obscured form, inside a workflow file, script, or
document. If a CI process needs to place a file, it reads that file from
a plain, committed path in the repo. A `git diff` on any change must show
the actual change in readable form.

---

## 5. Evidence over description

A claim that something was tested, verified, or checked must be
accompanied by the actual evidence when asked for it — the real payload,
the real log output, the real file — not a redescription of what the
evidence showed. "I checked X and it confirmed Y" is a claim; the
tool output, HTML snippet, or file itself is the evidence. Either AI can
ask the other for the underlying evidence at any point, and "I already
described this" is not a substitute for producing it.

---

## 6. Conflicting claims go to Mike, not to whichever AI answers first

If ChatGPT and Claude produce different answers about the same fact (a
security decision, a deployment status, what a function does), neither
AI resolves this unilaterally by deciding which of the two is right.
State the conflict plainly and let Mike decide, or get both systems to
independently re-check the same underlying evidence (the actual file,
the actual database, the actual build) until they agree on what's
actually there.

---

## 7. Every status claim is dated

When either AI states a status (per Section 1's vocabulary), it comes
with the date the check was actually performed. "STATIC FEED
AUTHORITATIVE" with no date is not checkable later; "STATIC FEED
AUTHORITATIVE — confirmed by inspecting APK build #14, 2026-09-19" is.

---

## 8. Files uploaded directly to one AI must be shared, not summarised

Files a person gives directly to one AI in its own chat interface (an
upload, a pasted attachment) are invisible to the other AI by default —
neither AI can see the other's conversation. If either AI works from
such a file (reviews it, cites it, bases a decision on it), that file
must be placed in the shared Drive folder before the other AI can be
expected to have equivalent context.

Rule: as soon as an AI receives a file directly (not already in Drive)
that is relevant to this project — source code, a build artifact, a
screenshot of real evidence, a document — it uploads that file to the
Drive folder (the matching numbered category folder if one fits, e.g.
`01 - SOURCE CODE` for code files, otherwise `98 - UPLOAD INBOX`) and
notes in AI-HANDOFF-LOG.md that it did so, with a one-line description
and a link.

This is not optional for files that inform a decision or a claim in
this document, ARCHITECTURE.md, or the handoff log. A finding based on a
file only one AI has seen is not verifiable by the other, and per
Section 5 (evidence over description) a description of a file is not a
substitute for the file itself.

This does not require uploading every screenshot or transient artifact —
routine back-and-forth, and evidence already fully quoted verbatim
elsewhere (e.g. a literal HTML snippet already pasted into the handoff
log), doesn't need a duplicate file. The bar is: would the other AI need
this file itself, not a description of it, to independently verify or
build on the finding?

---

## Changelog

- **2026-09-19:** Created, following discovery that two independent AI
  systems had produced conflicting claims about the same security
  decision (native bridge allowlist review) and that a feature described
  as architecturally "authoritative" was never actually present in a
  shipped build.
- **2026-09-19 (later):** Added Section 8 (shared file access), after
  finding that several files central to that day's findings — the full
  Android app.js source, index.html, and the build workflow YAML — had
  been uploaded directly into one AI's chat and were never placed in the
  shared Drive folder, meaning the other AI could not independently
  verify or build on findings drawn from them.
