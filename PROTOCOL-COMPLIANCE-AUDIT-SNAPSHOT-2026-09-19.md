# AI Collaboration Protocol Compliance Audit

**Date checked:** 2026-09-19  
**Scope:** `Grassroots Club Hub - Master Files` active folders plus the current
Android v2.2.2 static-feed source package.

## Result

The protocol has been applied to the active Google Drive status-bearing material
and canonical Android source handoff. Ordinary runtime code/data files were audited
but not rewritten merely to add status boilerplate.

**Important boundary:** the repository evidence snapshot `main @ 302508c` still
contains the pre-protocol base64 patch workflow. Therefore the actual GitHub release
pipeline must **not** yet be described as protocol-compliant. Repository remediation
is **PLANNED** until that workflow is replaced in GitHub and the new repository bytes
are re-read/verified.

## Changes applied

### Canonical master

- Added/updated `ARCHITECTURE.md` with dated protocol vocabulary.
- Added `CURRENT-STATUS-MANIFEST.md`.
- Retained `AI-COLLABORATION-PROTOCOL.md` as the governing collaboration file.
- Added `BUILD-VERIFICATION-v2.2.2.md` as artifact evidence.

### Android source package

- `README_BUILD.txt` updated to v2.2.2 and evidence-backed statuses.
- `RELEASE_NOTES_v2_2_2.txt` replaces the stale current v2.2.1 release note.
- `LIVE_BACKEND_CONTRACT_v2_2_1.txt` now states its verified date and explains the
  backend/client version distinction.
- `.github/workflows/android.yml` renamed logically to v2.2.2 Static Feed and its
  uploaded artifact name now matches v2.2.2.
- Added protocol and architecture snapshot files to the source handoff.
- Added build-verification evidence to the source handoff.
- Legacy SQL/Edge/reference files now carry a dated `WRITTEN historical reference`
  warning so old “live/deployed” comments cannot be mistaken for current status.

### Obsolete planning material

- `TODO-SYNC-INTEGRATION.md` is superseded and should live only in archive.
- Its former “PLANNED, not integrated” claim no longer competes with the verified
  v2.2.2 APK state.

### Encoded-source rule

The old patch workflow `build-apk-static-feed.yml` contained base64-embedded Java
and JavaScript source. That violates protocol Section 4.

A readable replacement workflow has been prepared. It builds the already-patched
source, verifies the expected 2.2.2/overlay/path markers, checks JavaScript syntax,
and verifies the resulting APK instead of reconstructing source from base64.


### Repository snapshot

Claude's Drive snapshot `main @ 302508c` was checked on 2026-09-19. Its
`.github/workflows/build-apk-static-feed.yml` is 75 KB and contains
`base64.b64decode`, `main_b64`, and `overlay_b64`. The snapshot has been renamed
as evidence rather than treated as canonical source.

The readable replacement workflow is **WRITTEN** in the canonical source handoff.
Actual GitHub replacement: **PLANNED / NOT VERIFIED**.

## Evidence-backed Android status

```text
Directory static integration: BUILT — checked 2026-09-19
Standings static integration: BUILT — checked 2026-09-19
Directory/standings DEPLOYED-LIVE: NOT VERIFIED
Fixture static cutover: PLANNED
Published-result static cutover: PLANNED
```

Verified v2.2.2 APK SHA-256:

```text
c38dea003e8f5f2342188fd5afa806b744cdf9a3275a2788aa4db09d5d84e246
```

Legacy APK (11) evidence:

```text
ZIP SHA-256:
1e4bf9565683c9f7edf9be6afdb1719a8fcd83c84190381c62bc53e95adeda5d

inner APK SHA-256:
b18199a2fb9de325d3353254fbacdeb07faaa973920c31be244300937c88455f
```

## Remaining external action

The Google Drive canonical files/source can be reconciled here. The actual GitHub
repository workflow must use the readable replacement workflow before the release
pipeline itself can be considered protocol-compliant. Until that repository write
is verified, release-pipeline consolidation remains **PLANNED**.

### Legal working copies

The Privacy Policy working copy was found to conflict with current U15 player-access
behaviour: it says players never have access at any age. Both legal documents were
classified/renamed **PLANNED** on 2026-09-19, and the privacy filename now flags the
U15 access conflict. No product/legal decision was made unilaterally; the conflict is
recorded for Mike in `AI-HANDOFF-LOG.md` and canonical `ARCHITECTURE.md`.
