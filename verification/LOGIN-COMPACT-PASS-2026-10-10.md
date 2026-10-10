# Login composition after mobile screenshot feedback

Mike supplied a live Android browser screenshot after PR55 merged and said the login page was still not quite right. The new labels and Show control were present, but the logo and photograph dominated the top of the page, the Welcome Back heading was very heavy, and the Parent/Player buttons only began at the bottom edge of the visible area. This feedback supersedes any assumption that PR55's visual layout was accepted.

## Changes

- Below 900px, the brand header uses a 52px-high original logo within a 64px minimum header. The photograph becomes an 80px banner (64px on screens no taller than 620px), instead of the previous 148px scene. Artwork bytes, object-fit containment and the existing photo positioning remain unchanged.
- Main form padding becomes 16px vertically. Heading is 26px on the stacked layout, 28px otherwise, at weight 700 rather than 900. The main sign-in introduction becomes “Sign in with your email and password.” Parent approval wording remains unchanged.
- Introductory, field and alternative-action gaps are reduced. Button text uses weight 700 and the account link 600. Inputs remain 16px and 52px tall; primary and secondary buttons remain at least 48px, with the other action targets at least 44px. Visible labels, focus outlines, Show/Hide, native submit, error messages and all sign-in routes are retained.
- The page still scrolls naturally with small viewports, enlarged text or an open keyboard. This does not guarantee every route fits on a single screen, and does not hide options or truncate messages to force that result.

## Integration and verification

Initial baseline was main 584f495b708c1780621cc2da9d0c5c0628c80385, including merged PR55 and PR54. The imported baseline whole tree matched 65bb057f34228d9cf3ebf1a2215ff4524a7a7487. Main then advanced through PR56 to 76bbb0a8c39d479ea484c6f8002aa9c1f97dd18b. Its three non-overlapping files were imported with exact Git blob matches, retaining friendly opponent age selection. This patch changes only auth CSS, one introductory string and this verification note.

88/88 JS tests, 191/191 UI source checks, club-logo technical quality, pilot rights scope and browser build passed before that non-overlapping import. The full checks are repeated on the final combined source, and their actual outcomes are recorded in the immutable task handoff and PR description. Browser assets are checked against source bytes.

## Rendered acceptance remains open

The attached screenshot was assessed directly; its reported local attachment path was unavailable. This managed environment lacks supported control-browser, and Sites instructions require skipping preview without an improvised alternative. No protected live account or child data was accessed. Source checks and successful builds do not prove the revised appearance.

After independent review and merge, confirm the main login on the same Android viewport shown by Mike, plus a narrow phone, Fold/tablet width, short landscape, desktop, enlarged text and the phone keyboard. Check that the shorter image still reads well, Parent/Player alternatives appear sooner, the logo retains its proportions, and every action and message remains reachable. Also check Parent, Player and recovery routes because the compact shared auth styling applies there. Existing review gate remains in force.
