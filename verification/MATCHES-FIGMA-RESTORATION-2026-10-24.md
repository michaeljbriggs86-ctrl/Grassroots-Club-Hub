# Matches page and Sunday dialog restoration — 24 October 2026

The previous distinct-photograph release changed the lead fixture card only. It did not establish full Matches-page parity with Figma. This repair restores two concrete missing compositions: the open preparation fields and the original Sunday match-details scene.

## Design authority

- Existing Figma file: `NY8QhcuOWiEcD0pKDTsbP8`, redesign page `490:9917`.
- Original Coach Matches: `490:10237`; preparation: `490:10268`. Open field stack, 18px title, 8px heading/acknowledgement gap, 12px field gaps and paired Squad/Formation fields.
- Original Sunday match-details dialog: `519:10559`. Offset 125/111px crest mounts, 113/97px unchanged badge artwork, stacked 34/18px team names and separate 57px kick-off time.
- Later shared materials/header/navigation authority remains `546`/`576`; lead fixture restoration remains `592:10773`. The separately approved corner-touchline card photograph is retained.
- Preimplementation review: https://drive.google.com/file/d/15BufL2FgCb0Z6TCtJgIQqL5MJXRC_DxY/view . The original Sunday board has no full Matches route. This repair does not claim an exact full-Sunday-Matches frame exists.

## Implementation and preserved behaviour

`matches-page.css` and `fixture-dialog.css` are scoped to the existing page and dialog and shipped through both cache manifests and the browser build. Six unchanged decorative SVGs were exported from the approved Figma nodes; provenance is in `app/src/main/assets/graphics/fixture/README.md`.

The dialog renders canonical fixture data and home/away badge DOM order; the visible own-team-first text composition follows Figma. Full timestamp, venue, truthful confirmation state, Cup groups and native availability count semantics remain. All existing map, editing, sharing, calendar, notification, disclosure and role/privacy gates are retained. Additional native fields/actions absent from the older example remain bounded adaptations. Wider, narrow and text-zoom layouts grow and scroll; no controls or data are deleted to reproduce a fixed-height example.

The rendered comparison caught two surviving legacy rules: a 94px badge cap and a 140px prep-header flex basis. Both were removed with scoped overrides. Native DOM measurements verify the intended geometry rather than relying on CSS source alone.

## Verification and limits

Run `python cloudflare/web-app/build.py`, then `node verification/browser/verify_matches_full_figma.cjs <playwright-module> <output-directory>`. The native verifier runs the real built application with intercepted fictional API data; it does not inject replacement CSS or write production records. It covers 42 page/dialog cases across dark/light, 320/393/768/1440px, confirmed/unconfirmed, H/A/N, Cup groups/TBC, parent boundaries, long names, 200% text and manual friendlies. It checks original composition, exact 8px prep heading gap, inner overflow, scroll access to timing/player controls, 44px selects, footer keyboard access, actual PNG sharing and native close. Runtime hashes must remain unchanged during the run.

Relevant canonical-card, kickoff, sharing, parent and matchday unit checks, the 42-case existing lead-card matrix and the 66-case Home matrix also pass. The latter two preceded the final dialog-only artwork/reflow and prep-heading spacing refinements; the new 42-case matrix covers the final artifact.

Known pre-existing CI failures remain outside this repair: `test_matchday_share.js` extracts an obsolete function signature, and `verify_notifications.cjs:44` compares background colour despite gradient materials. Do not describe all repository CI as green.

Local native screenshot/measurement review is supporting QA. Authenticated production role interaction and formal independent Claude acceptance remain open; publication must separately verify the deployed source snapshot and served assets. No broader whole-app fidelity or architecture acceptance is claimed.
