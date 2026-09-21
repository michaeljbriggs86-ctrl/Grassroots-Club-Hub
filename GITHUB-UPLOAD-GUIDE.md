# GitHub upload and APK build

## What to upload
Upload the **contents of this folder** to the root of the existing GitHub repository. Do not upload this ZIP as a single file if you expect GitHub Actions to build it.

Important: keep the repository/path used by the existing static feed unless you deliberately migrate the feed too. The Android source currently expects:
- `raw.githubusercontent.com/michaeljbriggs86-ctrl/Grassroots-Club-Hub/main/data/directory.json`
- `raw.githubusercontent.com/michaeljbriggs86-ctrl/Grassroots-Club-Hub/main/data/results.json`

This bundle does not replace those two generated feed files. If they already exist in the repository, keep them.

## Required repository files
The Android project itself is at the repository root. GitHub Actions needs:
- `.github/workflows/build-apk.yml`
- `build.gradle`
- `settings.gradle`
- `gradle.properties`
- `app/`
- `verification/verify_v2_2_8_pitchkind_ui.py`

Everything else in this bundle is documentation, provenance or retained historical/reference material.

## Build
1. Commit/push the files to `main` or `master`.
2. Open the GitHub repository -> **Actions**.
3. Select **Android APK v2.2.8 PitchKind**.
4. If it did not start automatically, choose **Run workflow**.
5. Wait for all steps to pass.
6. Open the completed run and download the artifact named **PitchKind-v2.2.8-debug**.
7. The artifact contains:
   - `PitchKind-v2.2.8-debug.apk`
   - `PitchKind-v2.2.8-debug.apk.sha256`

A successful workflow establishes BUILT only after the artifact gate has inspected that exact APK. It does not establish DEPLOYED/LIVE.

## Do not add a second APK workflow
This bundle deliberately contains only one APK-producing workflow. Retire/delete older competing APK workflows when applying it to an existing repository.
