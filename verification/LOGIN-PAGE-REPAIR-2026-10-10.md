# PitchKind login page repair

Mike asked “Fix the log in page” after the all-profile screen consistency pass. This fixes demonstrated source-level layout and control issues. No failed live login, account credentials or server error was supplied, so this is not a claim that a particular backend authentication failure was reproduced or repaired.

Initial base: `f44c47ced527db4b0c6025a5cb9cd3a4e4879d0d`, incorporating merged consistency PR52 and UI verifier PR51. Local imported tree matched `1987e26c57fe369776e86ea821329b2d635a0aee` before edits. Final publication base is `647131070195e627395e4ff9e5e1929d335a8478`; concurrent Slade transparency/Cannons mapping PR53 and its directory publication were preserved byte for byte. The full JS suite, UI gate and browser build passed again on that combined source.

## Findings and changes

- The old short-landscape layout declared at least 280px + 360px columns at widths starting at 600px, while the gate hid horizontal overflow. Authentication now uses a single stack below 900px, with zero-minimum equal columns on wider screens. Short screens reduce the decorative scene and keep natural vertical scrolling. Desktop auto margins center only when space is available; enlarged content can start at the top and scroll.
- The parent Back control was absolutely placed in the logo header and could overlap the wide lockup. It now lives inside the form area, in normal flow. Removed the duplicate bottom parent Back link; the existing Back handler remains. Recovery and other account routes retain their own Back controls.
- Generated input labels used visually hidden markup. Each now has a persistent visible 14px label outside its field, preserving the label association, escaped content, name, autocomplete and supplied input attributes. This shared helper also improves player/recovery/signup inputs.
- Replaced the ambiguous password symbol with Show/Hide text. The button updates its accessible action and pressed state while retaining the exact typed password. The 62px control is anchored to the input, below its label, and the field reserves room for it.
- The auth surface remains the approved white composition. Explicit auth-scoped input/select/option colors prevent dark app styles producing dark input patches on that white surface. Main and recovery text use the approved ink/copy colors. Auth changes do not change the selected theme for the signed-in app.
- Login form uses an explicit spaced stack, clear error/notice gaps and 13px feedback, 16px inputs, readable 14px action text and at least 44–48px targets. Parent/player routes sit side by side when space permits and stack on narrow phones. Recovery cards inherit the same field and text hierarchy. Existing primary/secondary hierarchy and focus outlines remain.
- Approved logo, football photograph and image bytes unchanged. Hero and signed-in screens unchanged in this patch. No Supabase request/session/token behavior, account eligibility, password/PIN policy, email confirmation, approval process, database or access rules changed. Successful authentication and native form submission still use the existing handlers.

## Verification

- 88/88 JavaScript test files PASS. New `test_login_controls.js` executes the real auth helpers and sign-in handler with synthetic inputs: visible linked labels, escaping and autofill attributes, reveal/conceal state and retained password, Parent Back navigation, no request with missing credentials, failed-sign-in retry and retained field values.
- The existing persistent-label expectation was updated from visually hidden to visible; its label association, name and escaping assertions remain. Parent-only sign-in still rejects staff and accepts approved parents, retains logout cleanup and native Enter submission.
- Reconciled UI source gate: 191/191 PASS. Actual protected browser bundle build and pilot rights scope PASS; emitted CSS/cloud.js/HTML equal source bytes. JavaScript syntax and whitespace checks PASS.
- Supabase skill guidance read; current official changelog and password-auth documentation checked. The markdown changelog fetch was unsupported, so the official HTML changelog was used. No API features were added or changed, no migration or dependency upgrade was needed, and no live database/account query was necessary for these presentation and control changes.

## Acceptance still open

This managed environment has no supported control-browser capability; the Sites skill requires skipping preview and forbids an improvised substitute. No signed-in account or child data was accessed. Source/behavior tests and a successful build do not prove rendered layout or an actual successful live sign-in.

Review main, Parent and Player entry, recovery, signup and approval screens at 360/390/430/600/768/900 widths, short landscape, enlarged text and with the on-screen keyboard. Confirm visible labels and feedback, no cropped form, no logo/Back overlap, password Show/Hide alignment, keyboard focus, scrolling and coherent auth field colors under both app theme preferences. Keep the existing independent-review gate before merge and protected live acceptance afterward.
