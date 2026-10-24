# Whole-app shared Figma restoration — 24 October 2026

The prior Matches-only correction did not address the mixed component generations across the website. This repair reconciles the common field, action, heading, result and inset families used by existing native routes and dialogs. It changes graphics and a duplicate dock highlight; it does not introduce workflows, data calculations or permissions.

## Existing design authority

Figma file `NY8QhcuOWiEcD0pKDTsbP8`, redesign page `490:9917`. Current shared board `546:10288` explicitly applies its material system across existing pages while preserving native controls, destinations and result visibility.

| Purpose | Reference | Implemented family |
|---|---|---|
| Raised/inset surfaces |546:10294/10335,546:10297/10338 | Current themed gradient, border, highlight and purpose-appropriate depth |
| Ordinary actions |548:10300/10302/10305/10307 |52px/r10/14px Inter600; solid green primary, gradient secondary; explicit compact utilities remain44px |
| Ordinary native fields |126:1639,490:11058,448:7595 plus546 material |52px/r12/16px Inter400, persistent14px labels and8px gap |
| Textareas |442:7595,227:6031 |96px ordinary minimum;104px registration medical context; native resizing retained |
| Full result cards |546:10300/10341 | Plain30px Barlow scores,14px identities and11px metadata |
| Comparison/archive rows |546:10309/10350 andwide546:10374/10376/10377 |14px Inter600 score/identity,12px supporting metadata; existing columns and responsive mapping |
| Programme matrix | Existing shared interactive matrix | Separate24px display scores and44px targets retained |
| Ordinary page headings | More210:4975/5111/5227/5306,Appearance212:5533,Notifications190:4675/4829 |30px InterBold; preserve specific Home/Matches/Squad/profile/Admin scene heads |
| Ordinary panel headings |546:10295/10336 |24px Barlow in ordinary workspace panels; explicit core scenes and prep excluded |

Preimplementation review: https://drive.google.com/file/d/1QzCN4dVbqG2EGKD5doaUCQJYhEQoT6Q2/view . High-fidelity code and actual Figma renders were inspected before implementation. Applying later shared materials to earlier native forms is a bounded adaptation; there is no claim that every native page has a complete original Sunday frame.

## Root causes and change boundaries

Legacy selector specificity and unlayered important rules overrode current materials on inputs, textareas and many secondary actions. Current selects had already been reconciled. The important `club-shared` layer now covers the missing native families, without deleting old stylesheets that contain visibility, role, responsive and operational rules.

Ordinary titles, panel titles, field labels and action typography now follow their correct purpose. Primary page headings remain readable over the pitch in both themes. The native Add Match form no longer has a second20px outer inset or a150px title/action gap caused by a horizontal flex basis surviving a column layout. Onboarding interiors and the qualification editor use the shared inset material; bare guidance/document links use the existing green link family.

Ordinary dialogs now have an explicit viewport maximum so the browser's em-based default does not reduce usable width at200% text. The qualification form no longer adds19px padding inside its already padded body/editor. Fullscreen post-match report mode retains its separate maximum. Narrow qualification date fields use8px horizontal padding and a20px calendar glyph so the full native date remains visible at200% text, without reducing the32px text or changing the native picker.

The Admin dock now marks exactly one destination current. Onboarding was absent from the direct-target set, so both Onboarding and More were highlighted; destinations, access and navigation actions are unchanged.

Do not flatten all surfaces into identical cards. Chat bubbles, statuses/warnings, garment scenes, Home and Matches compositions, data tables and the interactive tactics pitch retain their distinct roles. Checkbox/radio/range/file semantics, native validation, draft safety, disabled controls, focus, original assets, result ordering, parent own-child boundaries and U7–U11 safeguards remain.

## Native verification and evidence boundaries

`verification/browser/verify_whole_app_materials.cjs` navigates the real built app with fictional in-memory API/account data. It captures native routes, populated onboarding progress/review, permitted profiles, qualification editing, Add Player, tactics and notifications. It asserts field/action/title families, single active dock destination and reflow. Real pointer dragging verifies textarea resizing. It does not inject substitute CSS or write production records.

Phone matrices cover all five roles in both themes; supplementary native League and Staff-request-review flows bring the union to all30 actual index view IDs. This does not mean all18 dialog variants were exercised. Desktop and200% text focus on ordinary forms. The verifier hashes every root CSS/JS/HTML runtime asset before/after each matrix. `verification/browser/verify_shared_components.cjs` retains functional/privacy interactions and now asserts the reviewed full-card/comparison/matrix distinctions rather than the superseded all-Barlow score assumption.

Existing native Home66, Matches42, More30 and shared-component checks pass. Standalone registration passes8 cases/48 layouts; native medical textareas retain104px and resize104→174px. Twelve relevant navigation/onboarding/canonical-card/sharing/parent/result unit suites pass. Final evidence records the exact artifact and any final scoped follow-up checks.

A separate `Shared Figma consistency matrix` CI workflow runs these current native guards independently of the existing UI job, which still stops on four known share source-extraction assertions. The existing notification checker also compares backgroundColor despite gradient surfaces. Do not claim every repository workflow is green.

These are local actual-build supporting checks. Production static files and deployment revision must be checked separately. The live sign-in page rejected the supplied credentials, so authenticated production role verification remains unavailable; formal independent Claude acceptance remains open. A known standalone long unbroken heading clipping limitation is not described as fixed. No whole-app exact-pixel or backend-security acceptance is claimed.

## Final visual and browser follow-up

Staff request review keeps its native Back action below the decision area, so its title/kicker need the same protected white photo treatment as other top-of-field headings. A focused both-theme/phone/200% review closes that contrast issue. Newer Chromium CI also found a fractional-width Onboarding label wrap at320px. The five-destination dock gap is3px (previously4), retaining its8px inset,10px labels and66px targets. Native single-line/within-cell legend guards retain that browser fix. Cache revision20261024b ships the follow-up together.
