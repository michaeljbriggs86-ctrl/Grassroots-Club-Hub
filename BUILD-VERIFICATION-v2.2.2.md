# Build Verification — Android v2.2.2 Static Feed

**Status:** BUILT  
**Checked:** 2026-09-19

Artifact inspected:

```text
Grassroots-Club-Hub-v2.2.2-static-feed.apk
```

SHA-256:

```text
c38dea003e8f5f2342188fd5afa806b744cdf9a3275a2788aa4db09d5d84e246
```

Observed inside the APK:

```text
GrassrootsClubHub/2.2.2
assets/index.html
assets/static-feed-overlay.js
```

`index.html` references:

```html
<script src="static-feed-overlay.js"></script>
```

The native bridge contains the exact static-feed host/path allowlist for:

```text
raw.githubusercontent.com
/michaeljbriggs86-ctrl/Grassroots-Club-Hub/main/data/directory.json
/michaeljbriggs86-ctrl/Grassroots-Club-Hub/main/data/results.json
```

This evidence supports **BUILT** only. It does not establish that this exact APK
is **DEPLOYED-LIVE** on tester/user devices.

For comparison, the previously downloaded `Grassroots-Club-Hub-APK (11).zip`
contains a 2.2.1 APK without the overlay. That proves the old build pipeline could
continue producing a successful but non-static-feed artifact.
