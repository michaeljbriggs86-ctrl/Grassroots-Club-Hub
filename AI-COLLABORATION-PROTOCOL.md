# AI Collaboration Protocol - PitchKind

**Status:** Living document, same revision discipline as ARCHITECTURE.md.

**Product name:** PitchKind (formerly Grassroots Club Hub), per Mike's decision of 2026-09-20 (AI-HANDOFF-LOG.md entries 16 and 17; APP-UI-DESIGN-GUIDELINES.md v1.3). Code identifiers, file names and artifact names that contain the old name are unchanged until Mike authorises the rename implementation. Trade-mark clearance for the new name is NOT completed.

This governs how any AI system (currently ChatGPT and Claude) working on
this project behaves: not what the system does technically (that's
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
were caused by bad intent: they happened because two systems kept
working in parallel without a shared way to state and check what was
actually true.

---

## 1. Status vocabulary - use these words precisely

A claim about any feature, integration, or fix must use one of these
words, and only when it's actually true:

- **PLANNED**: described, not built. No code exists yet.
- **WRITTEN**: code exists, has not been run against real data or a
  real build.
- **TESTED**: run against real or synthetic data in isolation (unit
  tests, manual parser checks). Not yet part of a real build/deployment.
- **BUILT**: included in an actual build artifact (an APK, a deployed
  Edge Function), confirmed by inspecting that artifact, not by
  inspecting the source that was supposed to produce it.
- **DEPLOYED / LIVE**: running in the environment real users hit.

**Never use "done," "complete," "working," or "live" without one of the
words above attached.** "The static feed integration is done" is not a
valid status. "The static feed integration is WRITTEN and TESTED, not
yet BUILT" is.

If a document says BUILT or DEPLOYED, that claim must be checked against
the actual artifact (the APK, the running function) before being
trusted, not inferred from the source code or workflow file that was
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
Section 0 and must be resolved, not left as two plausible-sounding
answers for whoever reads which file first.

---

## 3. Before building, check what already exists

Before adding a new data pipeline, sync system, scraper, or storage path:
check the Single Source-of-Truth Register in ARCHITECTURE.md Section 2.
If the thing you're about to build might already exist in another form
(a dormant Supabase system, an old script, a different AI's earlier
work), that's not a fact to discover after building: it's a check to
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
accompanied by the actual evidence when asked for it: the real payload,
the real log output, the real file, not a redescription of what the
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
AUTHORITATIVE, confirmed by inspecting APK build #14, 2026-09-19" is.

---

## 8. Files uploaded directly to one AI must be shared, not summarised

Files a person gives directly to one AI in its own chat interface (an
upload, a pasted attachment) are invisible to the other AI by default:
neither AI can see the other's conversation. If either AI works from
such a file (reviews it, cites it, bases a decision on it), that file
must be placed in the shared Drive folder before the other AI can be
expected to have equivalent context.

Rule: as soon as an AI receives a file directly (not already in Drive)
that is relevant to this project (source code, a build artifact, a
screenshot of real evidence, a document), it uploads that file to the
Drive folder (the matching numbered category folder if one fits, e.g.
`01 - SOURCE CODE` for code files, otherwise `98 - UPLOAD INBOX`) and
notes in AI-HANDOFF-LOG.md that it did so, with a one-line description
and a link. (Under Section 10, that note is written as an inbox entry.)

This is not optional for files that inform a decision or a claim in
this document, ARCHITECTURE.md, or the handoff log. A finding based on a
file only one AI has seen is not verifiable by the other, and per
Section 5 (evidence over description) a description of a file is not a
substitute for the file itself.

This does not require uploading every screenshot or transient artifact:
routine back-and-forth, and evidence already fully quoted verbatim
elsewhere (e.g. a literal HTML snippet already pasted into the handoff
log), doesn't need a duplicate file. The bar is: would the other AI need
this file itself, not a description of it, to independently verify or
build on the finding?

---

## 9. Roles and responsibilities (app work only)

This section applies to the PitchKind app itself (formerly Grassroots
Club Hub): the Android/web client, backend, and data pipelines. It does
not cover other work either AI does with Mike (the coaching manual, the
Etsy shop, etc.).

The split is not "who owns the app": one AI holding both production
and verification authority would remove the exact check that caught
tonight's problems (the static-feed gap, the duplicate build workflow,
the security-review discrepancy). The split is by function instead:

- **Production authority: ChatGPT.** The Android/web codebase, GitHub
  Actions workflows, Supabase schema and functions, and the final
  implementation call once direction is set. This matches ChatGPT's
  actual access: direct repo, direct Supabase, direct build inspection.

- **Independent verification: Claude.** Before any claim in
  ARCHITECTURE.md graduates to BUILT or DEPLOYED (Section 1), it is
  checked by whichever AI did not build it, reviewing the actual
  evidence (a build artifact, real SQL, a real payload) against the
  claim being made, per Section 5. This only works when the checker is
  not the builder; it is not a role either AI can also hold on its own
  work.

- **Shared documentation stewardship: Claude by default.**
  ARCHITECTURE.md, this file, and AI-HANDOFF-LOG.md live in Drive,
  where Claude has reliable read/write access and has been keeping them
  current. ChatGPT can still write to them directly, and should, per
  Section 8, but Claude is the one expected to notice when two
  documents disagree, since that is what the verification role already
  requires.

- **Legal/product documents (Privacy Policy, DPA): split.** ChatGPT
  drafts, since it has direct visibility into the Supabase compliance
  schema these documents need to describe accurately. Claude checks the
  draft against actual product behaviour: the same adversarial check
  that caught the U15 access conflict. Neither AI decides the
  underlying product or legal position; that stays Mike's call under
  Section 6.

- **Arbitration, and anything neither AI can reach: Mike, unchanged.**
  Conflicting claims still go to Mike, not to whichever AI answers
  first (Section 6). Anything requiring a real browser session (the
  Selkent endpoints) or repository permissions neither AI has (e.g. the
  403 ChatGPT hit deleting a workflow file) also stays with Mike.

---

### Standing authorisation to publish requested app changes (Mike, 2026-10-22)

Mike has given standing authorisation to implement requested PitchKind / Shooters Hill AFC app changes, commit them, push directly to the existing GitHub repository's `main` branch and deploy them to the existing live website. No separate approval, per-commit confirmation or final "may I publish?" step is required for work within his requested scope. This includes the friendly kick-off and venue fix discussed on 2026-10-22.

Complete the applicable Figma review, relevant tests and build checks, preserve concurrent changes, then publish and inspect the running artifact. These checks are work to perform autonomously, not reasons to request repeated permission. Independent verification and evidence requirements remain in force; distinguish publication from acceptance and never infer LIVE status from a push alone.

This authorisation concerns app implementation and publication. Existing requirements for a new product/design departure, generated-image approval and changes outside the requested scope remain applicable. It does not alter tool-enforced permissions. If a tool actually blocks an action, report the specific rejection accurately; do not treat an additional approval as a project rule or try to bypass the tool's restriction.

Record decisions and evidence in a NEW `97 - LOG INBOX` entry under protocol Section 10. Never edit the master handoff index, history or an existing entry.

## 10. Handoff log write protocol

**Status:** WRITTEN. The original protocol was approved by Mike 2026-09-19.
It was revised on 2026-09-20 (log entries 21 and 22) and the revision was
approved by Mike. Adoption of the revision by ChatGPT is NOT YET CONFIRMED:
it needs the custom instruction updated to match this section.

Problems this section solves:

- On 2026-09-19 several writers each replaced the whole log file. One
  session's version was trashed by another session's rewrite, and a
  duplicate log briefly existed. Every replacement also changed the file ID.
- On 2026-09-20 a copying error was found in an old entry. The Drive
  connector cannot edit a file in place, so a compiler that rewrites the
  whole log re-types every old entry each time. Old entries must therefore
  never be re-typed.

Structure:

- `AI-HANDOFF-LOG.md` is a short index. It gives how to read and write the
  log, the current status of every entry, and known errors (errata). It is
  the only log file a compiler re-types.
- `AI-HANDOFF-LOG-HISTORY_entries-1-20.md` holds entries 1 to 20 and the
  older sections as compiled on 2026-09-20. It is frozen. Where the index
  and the history file disagree on an entry's status, the index is right.
- From entry 21 onwards, each entry stays as its own file, created in
  `97 - LOG INBOX` and later moved unchanged to `97 - LOG INBOX/processed`.

Rules:

10.1 Nobody edits or replaces the index, the history file or any entry
file, except that the compiler re-types the index under 10.4. The history
file and entry files are never edited or re-typed.

10.2 To add an entry, create a NEW file in the folder `97 - LOG INBOX`,
named `LOG-ENTRY_YYYY-MM-DD_HHMM_<author>_<short-slug>.md`, for example
`LOG-ENTRY_2026-09-20_0901_claude_log-restructure.md`. The content is the
entry in the usual format (heading with OPEN or ANSWERED, addressee, date,
status block). Do not number it; the compiler assigns the number.

10.3 Replies to an existing entry are also new inbox files, with the
entry they answer named on the first line. Existing text is never edited
by the person replying.

10.4 Compiler: Claude (documentation steward, Section 9). When Mike asks,
or at the end of a working session, the compiler:

- a) reads the current index and every file in the inbox that is not in
  `processed`;
- b) checks the index's modified time and file ID have not changed since it
  was read;
- c) numbers each inbox file in order of creation, continuing from the
  highest number in the index, and adds a row for each (status, date, from
  and to, subject, file name). It changes the status of an older entry in
  the index only when a new entry answers it. It never edits an entry;
- d) writes the new index, checks it against the inbox files, then moves the
  previous index to `99 - ARCHIVE` as
  `SUPERSEDED - AI-HANDOFF-LOG-INDEX_<date>-<time>.md`;
- e) moves the inbox files, unchanged, to `97 - LOG INBOX/processed`.

10.5 Readers: before relying on the log, read the index AND any files in
`97 - LOG INBOX` that are not in `processed`. Open entry files and the
history file by name when the full text is needed. Open files by name and
folder, never by a saved file ID or link.

10.6 If two files named `AI-HANDOFF-LOG.md` ever exist, stop and ask Mike.
Do not trash either until the differences are reconciled.

10.7 An urgent entry is still an inbox file. Mike may ask any AI to run the
compile immediately.

Known limits: the compiler still re-types the index each time, so a small
copying error there is possible, which is why the index is kept short enough
to check by eye. The history file contains a known error (see the index
errata) and cannot be corrected in place. Adherence by ChatGPT depends on its
custom instruction; the protocol cannot enforce it.

---

## Changelog

- **2026-10-22:** Recorded Mike's standing authorisation to commit, push requested app changes directly to `main` and deploy to the existing live website without repeated publication approval. Existing review, test, artifact-evidence and independent-verification duties remain.

- **2026-09-19:** Created, following discovery that two independent AI
  systems had produced conflicting claims about the same security
  decision (native bridge allowlist review) and that a feature described
  as architecturally "authoritative" was never actually present in a
  shipped build.
- **2026-09-19 (later):** Added Section 8 (shared file access), after
  finding that several files central to that day's findings (the full
  Android app.js source, index.html, and the build workflow YAML) had
  been uploaded directly into one AI's chat and were never placed in the
  shared Drive folder, meaning the other AI could not independently
  verify or build on findings drawn from them.
- **2026-09-19 (later still):** Added Section 9 (roles and
  responsibilities for app work), splitting production authority
  (ChatGPT) from independent verification (Claude) rather than giving
  either AI both, since combining them would remove the cross-check
  that caught the static-feed gap, the duplicate build workflow, and
  the security-review discrepancy earlier the same day.
- **2026-09-19 (evening):** Added Section 10 (handoff log write
  protocol) after concurrent whole-file rewrites of AI-HANDOFF-LOG.md by
  separate sessions caused a fork and a duplicate log. Approved by Mike.
  Created the `97 - LOG INBOX` folder and its `processed` subfolder.
- **2026-09-20:** Product name updated in the title, a product-name
  note added under Status, and Section 9's opening line, following
  Mike's decision that Grassroots Club Hub is no longer the name
  (AI-HANDOFF-LOG.md entry 17). No rule was changed. Punctuation only:
  em dashes were replaced with hyphens or colons. Superseded copy
  archived as `SUPERSEDED - AI-COLLABORATION-PROTOCOL_2026-09-19.md`.
- **2026-09-20 (later):** Revised Section 10 after a copying error was
  found in the compiled log (entry 21). The log is now an index plus a
  frozen history file plus individual entry files, so old entries are
  never re-typed (entry 22). Approved by Mike. Adoption by ChatGPT not
  yet confirmed. Superseded copy archived as
  `SUPERSEDED - AI-COLLABORATION-PROTOCOL_2026-09-20-early.md`.

---

## October 2026 adopted workflow clarification — 2026-10-24

Mike approved the targeted governing-guidelines rewrite on 2026-10-24. This clarification preserves the original Section 10 immutable log protocol, independent verification requirement, status vocabulary and safeguarding gates.

The 2026-10-22 standing authorisation means requested in-scope Shooters Hill AFC/PitchKind app fixes may be reviewed against current Figma, tested, committed and pushed to main and deployed without another per-commit approval request. It does **not** authorise unrelated scope expansion, new child-data access, unlicensed badge use, new product direction or bypassing a real tool/security block.

Document authority is deliberately divided: ARCHITECTURE.md controls implementation/data authority and roles; APP-UI-DESIGN-GUIDELINES.md controls app-visible design and interaction; BRAND-GUIDELINES.md extends brand/imagery rules across public and external platforms; this protocol controls change, evidence and handoff. Prefer cross-references rather than inconsistent full-length duplicate rules.

Always distinguish (1) written source, (2) isolated tests, (3) inspected built artifact, (4) actual live serving, (5) authenticated user-flow acceptance and (6) independent Claude review. Producer QA cannot be called independent acceptance. Date each claim and preserve known test failures.

Create new entries only in `97 - LOG INBOX`, named `LOG-ENTRY_YYYY-MM-DD_HHMM_chatgpt_<slug>.md` using real Europe/London time; never modify the master AI-HANDOFF-LOG.md, its frozen history or any existing entry. Before relying on the log, read the master by name/folder and every unprocessed inbox item. Stop if two canonical AI-HANDOFF-LOG.md files are found.

