# Grassroots Club Hub — App UI Design Guidelines

**Document status:** ACTIVE — GOVERNING UI STANDARD  
**Version:** 1.2  
**Effective date:** 2026-09-19  
**Applies to:** Android app, web/test build, all current screens, all future screens, all roles  
**Visual reference:** `APP_WIDE_UI_REFERENCE_v1_1_2026-09-19.png`  
**Implementation reference:** `AUTH_LOGIN_REFERENCE_v1_1_2026-09-19.png`  
**Code marker:** `approved-app-ui-2026-09-19-v1.2-brand-system`

## 1. Authority and change control

This document is the single governing UI standard for Grassroots Club Hub.

**No deviations. No exceptions.** Any proposed change to these rules must be explicitly discussed with and approved by Mike before implementation. Approval must be recorded in `AI-HANDOFF-LOG.md` and, where it changes architecture or a source-of-truth decision, in `ARCHITECTURE.md` before the change is treated as authorised.

ChatGPT, Claude, future AI systems, developers and contributors must treat this file as a hard implementation contract, not a mood board, suggestion, or loose theme.

When a screen or component conflicts with this document, the screen/component is the item that must change unless Mike explicitly approves an exception.

## 2. Scope

The standard applies to the entire product, including:

- login and authentication;
- Player Access;
- club sign-up and onboarding;
- home/dashboard;
- fixtures and matches;
- results and league tables;
- teams and squad pages;
- player profiles;
- awards;
- messages/inbox;
- club administration;
- settings/account;
- dialogs, forms, empty states and errors;
- loading, confirmation and status states;
- all future screens and features.

A screen is not exempt because it is old, admin-only, infrequently used, a recovery flow, or still under development.

## 3. Core design principles

1. **Football first** — the product must visually feel like a grassroots football app.
2. **Real imagery** — use generated or licensed photographic football imagery, never artificial shapes pretending to be footballs, goals, pitches, players or other football objects.
3. **One product family** — all areas must use the same visual language, colour system, typography, spacing, controls and navigation treatment.
4. **Responsive by construction** — layouts must adapt without hiding, clipping, crushing or awkwardly crowding content.
5. **Readable and accessible** — clear hierarchy, sufficient contrast, readable body text and comfortable touch targets are mandatory.
6. **Simple and trustworthy** — avoid decorative clutter, excessive gradients, novelty UI and dense information walls.
7. **Community-focused** — wording and imagery should feel positive, supportive and appropriate for grassroots football clubs and families.

## 4. Brand identity

### 4.1 Product logo and primary lock-up

The approved Grassroots Club Hub identity is the **grass-O wordmark system**. The letter **O** in **Grassroots** is the distinctive brand device and contains the grass treatment. Do not replace it with a shield, a generic football badge, a plain geometric symbol, or an unrelated club mark.

The only primary product lock-up is:

**Grassroots Club Hub**  
**CONNECT • ORGANISE • GROW THE GAME**

The product name uses **Club** (singular), never **Clubs**. The tagline above is exact and must not be replaced by role-specific slogans inside the official lock-up. Contextual copy may appear elsewhere on a screen, but it is not part of the logo.

Approved implementation assets:

- `gch-logo-primary.svg` — dark-green wordmark for white/light surfaces;
- `gch-logo-reverse.svg` — reverse wordmark for dark-green surfaces;
- `gch-mark.svg` — compact grass-O product mark and neutral missing-club-badge fallback;
- `gch-app-icon.svg` / raster launcher derivatives — native/PWA launcher icon;
- `gch-banner.svg` — wide product banner for onboarding/about/product-only brand surfaces.

Do not stretch, recolour, crop through, redraw, or add text inside these approved assets.

### 4.2 Handwritten accent

The approved handwritten accent is **“More Than A Game”**.

It may be used as a supporting brand accent over suitable hero imagery. It must not become the primary typeface, be used for functional text, or reduce legibility.

### 4.3 Tone

Friendly, calm, inclusive, concise and professional. Avoid corporate jargon, childish wording, hype language and unnecessary technical terminology.

### 4.4 Product brand vs club brand — placement rules

Grassroots Club Hub branding identifies the **platform**. Club badges identify the **club**. These are not interchangeable.

| Surface | Required brand asset | Rule |
|---|---|---|
| Android launcher / PWA icon | `gch-app-icon` | Product identity only; never use a club badge. |
| App splash | `gch-logo-reverse.svg` | Product identity only; club configuration must never overwrite it. |
| Adult login, Player Access, Club Sign Up and account recovery | `gch-logo-primary.svg` | Same official lock-up on every auth variant. |
| Club-creation onboarding | `gch-banner.svg` | Product banner above setup flow; club-badge picker remains separate. |
| Settings / About | `gch-banner.svg` or `gch-logo-primary.svg` | Product identity and app version. |
| Signed-in club/team header | verified club badge | Use the selected club's badge when available. |
| Missing/unverified club badge | `gch-mark.svg` | Neutral product placeholder only; never invent initials or guess a badge. |
| Fixtures, results, tables, team/club pages | verified club badge where club identity is shown | Do not replace club identity with the platform logo when a verified badge exists. |

The app may display product and club identity on the same overall screen only when their roles are visually clear. Product branding must not masquerade as the selected club badge, and club configuration must not mutate launcher, splash or authentication branding.

### 4.5 Logo clear space and sizing

- Keep at least the visual width of the grass-O stroke around the full lock-up.
- Full wordmark must remain legible; use `gch-mark.svg` when the available space is too small for the tagline.
- Do not place the full lock-up inside a circular crop.
- App icons may use the approved rounded-square or round launcher derivative, but the internal grass-O must remain centred and uncropped.
- On dark surfaces use the reverse asset rather than applying CSS filters to the primary logo.

## 5. Colour system — exact tokens

These values are authoritative in code.

| Token | Hex | Use |
|---|---:|---|
| `--gch-green-950` | `#064526` | deepest brand accent, strong text on pale green |
| `--gch-green-900` | `#0B5D35` | primary headings, dark brand areas |
| `--gch-green-800` | `#0D6A3A` | strong links and outlined actions |
| `--gch-green-700` | `#0F7B42` | active state / links |
| `--gch-green-600` | `#168848` | primary action base |
| `--gch-green-500` | `#29A64D` | highlight/accent only |
| `--gch-soft-green` | `#EEF6F1` | information surfaces / soft panels |
| `--gch-info-green` | `#E8F7ED` | success/information background |
| `--gch-canvas` | `#F3F6F4` | app background |
| `--gch-white` | `#FFFFFF` | cards, forms, primary surfaces |
| `--gch-ink` | `#111715` | primary text |
| `--gch-copy` | `#4F5F55` | normal supporting copy |
| `--gch-muted` | `#66756D` | metadata/helper text |
| `--gch-line` | `#D8E0DA` | borders and dividers |
| `--gch-error` | `#A52626` | error text |
| `--gch-error-bg` | `#FFF0F0` | error background |

Do not introduce a new dominant colour for a feature or role. Status colours may be used sparingly where meaning requires them, but the page chrome remains green/white.

## 6. Typography

Primary family:

`Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`

Use responsive sizes with `clamp()` where appropriate rather than fixed oversized text.

- Screen title: 28–36 px, 800–900 weight, compact line-height.
- Section title: 20–28 px, 750–900 weight.
- Card title: 16–20 px, 700–850 weight.
- Body: 14–17 px, 450–600 weight, minimum 1.4 line-height.
- Helper/caption: 12–14 px, minimum 1.35 line-height.
- Button: 14–16 px, 750–900 weight.
- Navigation label: 11–13 px, 700–850 weight.

Text must wrap naturally. Do not force single-line text where it can truncate important information.

## 7. Imagery rules — non-negotiable

### 7.1 Required

Use realistic generated or licensed photographic imagery of:

- real-looking footballs;
- real-looking football goals and nets;
- pitches and grass;
- grassroots players/teams;
- corner flags;
- football environments and club activity.

Images must have natural lighting, plausible perspective and photographic depth.

### 7.2 Forbidden

Do **not** use:

- CSS circles/polygons combined to imitate a football;
- lines/rectangles combined to imitate a goal or pitch;
- SVG drawings pretending to be photographic football objects;
- cartoon footballs or clip-art football scenes;
- abstract placeholder blobs used as football imagery;
- stretched, pixelated or visibly low-resolution images.

SVG remains allowed for **interface icons and official branding marks**, not as a substitute for football photography.

### 7.3 Image treatment and resolution

- Use `object-fit: cover` or equivalent `background-size: cover` for hero images.
- Preserve focal subjects with `object-position` / `background-position`.
- Never stretch an image to fit.
- Use subtle green/black overlays only when required for text contrast.
- Images support the UI; they must not make forms or data harder to read.
- **Hero source assets must be at least 1600 px wide; 1920 px or wider is preferred.**
- Where a hero is displayed in a high-density WebView, provide enough source pixels for the rendered CSS size and expected device pixel ratio.
- JPEG/WebP compression must not introduce visible blockiness, blur or ringing at normal device viewing size.
- Separate mobile/tablet/landscape crops may be supplied where one crop cannot preserve the focal subject.
- The approved handwritten `More Than A Game` accent may appear **once** in a generated hero image or as a UI overlay, never both.
- Do not place a second decorative photo strip below authentication forms. One strong hero image is enough.

## 8. Layout and responsive behaviour

Responsive behaviour is mandatory, not optional polish.

### 8.1 General rules

- Use flexible/grid layouts, not fixed pixel positioning.
- No important content may be clipped, hidden behind system bars, or pushed off screen.
- No horizontal scrolling for standard application screens.
- Tables/data grids that genuinely exceed the width may use an explicit scroll container.
- All screens must respect Android safe-area/system insets.
- Long screens scroll vertically; do not shrink text/forms merely to force everything into one viewport.
- Avoid fixed content heights. Use `min-height`, `clamp()`, grid/flex and content-driven sizing.

### 8.1.1 Android/WebView inset contract

Android `WindowInsets` arrive in **physical pixels**. WebView CSS layout uses CSS-pixel/dp-like units. The native Android layer must convert physical pixels using display density **before** writing `--android-inset-top` and `--android-inset-bottom`.

The same inset must never be applied twice. For authentication, the top inset is applied to the brand/header region only; the outer auth shell must not add the same top inset again.

Defensive limits are permitted to protect against invalid platform values, but they must not hide content. This contract exists specifically to prevent the large blank header gap seen on high-density Android devices in the v2.2.5 build.

### 8.2 Required device classes

**Small phones: 320–374 CSS px**  
Single column. Full-width primary actions. Reduced decorative image height if needed, but readable controls/text are never compressed.

**Standard phones: 375–439 CSS px**  
Single column with standard spacing and comfortable hero imagery.

**Large phones: 440–599 CSS px**  
Single column or selective two-column cards where it improves clarity.

**Small tablets / foldables: 600–899 CSS px**  
Wider content frame; two-column grids allowed for independent cards/forms.

**Large tablets / web: 900+ CSS px**  
Centered maximum-width content; multi-column card layouts permitted; individual forms retain comfortable readable line lengths.

### 8.3 Orientation

Portrait and landscape must both remain usable. Landscape must not hide controls or force tiny text.

### 8.4 Vertical space

Short screens must scroll. Do not reduce buttons below 44 px, body copy below 14 px, or fields below 46 px to fit more content vertically.

## 9. Spacing and geometry

Use a shared spacing rhythm based on 4 px increments.

Preferred spacing tokens: 4, 8, 12, 16, 20, 24, 32 px.

- Screen side padding: 16–22 px on phones.
- Card padding: 14–18 px.
- Major section gap: 16–24 px.
- Control gap: 8–12 px.
- Card radius: 16–20 px.
- Field radius: 10–12 px.
- Primary button radius: 10–14 px.
- Touch target: minimum 44 × 44 px.

Do not create one-off radii, shadows or arbitrary spacing per screen.

## 10. Core component standard

### 10.1 Primary button

- dark/medium brand green background;
- white text;
- strong weight;
- full width on phone where it represents the page’s main action;
- minimum height 48 px;
- subtle shadow only;
- arrow icon may appear at right for forward actions.

### 10.2 Secondary button

- white background;
- green outline/text;
- same height/radius family as primary action.

### 10.3 Text fields and selects

- white surface;
- `#D8E0DA` border;
- 10–12 px radius;
- minimum 48 px height;
- clear label/placeholder;
- focus ring in brand green;
- no cramped inline fields on small phones.

### 10.4 Cards/panels

- white or soft-green surface;
- thin neutral border;
- 16–20 px radius;
- low-contrast shadow;
- clean section title and metadata hierarchy.

### 10.5 Information/status banner

- pale green for positive/informational status;
- clear icon + text;
- rounded 10–14 px;
- error states use pale red, not a new overall page theme.

### 10.6 Navigation

- green for active item;
- muted neutral for inactive item;
- same icon family throughout;
- readable labels;
- no overcrowded navigation rows.

If the number of destinations cannot fit comfortably, use a “More” destination instead of shrinking labels or touch areas.

## 11. Screen structure standard

All standard screens should follow this hierarchy where applicable:

1. safe-area/header;
2. clear screen title/context;
3. optional real football hero imagery;
4. primary content groups/cards;
5. primary action close to the content it affects;
6. supporting/help text;
7. persistent navigation where appropriate.

Do not use unrelated one-off page templates.

## 12. Authentication screens

The login family remains:

- Adult login — email + password;
- Player Access — player name + reusable player code, U15-only boundary unchanged;
- Club Sign Up — separate organisation creation path.

These screens must use real generated football imagery assets. The three hero images may differ, but composition, brand header, fields, buttons and spacing must remain one family. Every authentication variant uses `gch-logo-primary.svg` and the exact **CONNECT • ORGANISE • GROW THE GAME** lock-up; role-specific slogans must not replace the official tagline.

Authentication layout requirements are explicit:

- compact safe-area/header spacing; **no large empty white region above the logo**;
- one high-resolution hero image immediately beneath the brand header;
- title/form content begins cleanly after the hero rather than overlapping it awkwardly;
- fields and primary/secondary actions remain at least 54–56 px high in the auth family;
- no duplicate `More Than A Game` overlay if it is already baked into approved hero art;
- no second blurred/decorative photo footer; use a simple branded footer surface;
- short screens scroll rather than compress;
- foldables and portrait tablets use a wider stacked composition;
- large tablets and short landscape displays may use a deliberate image/content split layout.

On short screens the page scrolls; the design must not crush the hero, form and explanatory content into an unreadable single viewport.

## 13. In-app pages

The green/white identity used by login must continue into the authenticated app.

- Main app header uses real football imagery with a legible overlay.
- Dashboard, matches, teams, results and settings use the same card/field/button tokens.
- Dark novelty panels should not dominate pages; information should primarily sit on white/soft-green cards.
- Existing role functionality may change what is shown, but not the design language.
- Admin, coach, parent and player views are the same product family.

## 14. Accessibility and readability

- Maintain strong text/background contrast.
- Minimum body text 14 px.
- Minimum touch target 44 px.
- Visible focus state for keyboard/web testing.
- Use semantic labels and accessible names.
- Never convey critical status using colour alone.
- Avoid all-caps for body text.
- Respect platform text rendering and safe-area insets.

## 15. Implementation rules for ChatGPT and Claude

Before changing UI code, both AI systems must:

1. read this document;
2. inspect the current source, not only screenshots or descriptions;
3. verify that the proposed change follows the existing shared tokens/components;
4. avoid creating a new visual pattern where an existing component can be reused;
5. preserve responsive rules;
6. preserve realistic imagery requirements;
7. test relevant JavaScript/CSS/source structure;
8. state status using the collaboration protocol vocabulary.

A change that intentionally differs from this document must stop at **PLANNED** until Mike explicitly approves the exception.

## 16. Acceptance checklist

A UI change is not accepted unless all relevant answers are **yes**:

- Does it use the approved grass-O product identity and exact `CONNECT • ORGANISE • GROW THE GAME` tagline where product branding appears?
- Does it keep product branding separate from verified club branding?
- Does it use the approved green/white design system?
- Does it use the approved type hierarchy?
- Are football visuals photographic/generated raster imagery rather than constructed shapes?
- Are hero source images at least 1600 px wide and visually sharp at device size?
- Is there exactly one intentional hero image with no low-quality second image strip?
- Does it reuse standard buttons, fields, cards and navigation?
- Does it work at 320, 360, 390, 412, 480, 600, 768 and 900+ CSS px widths where applicable?
- Can the screen scroll rather than crush content on short displays?
- Is all important text readable and visible?
- Are controls at least 44 px high/wide where tappable?
- Does it avoid horizontal overflow on standard screens?
- Does it respect safe areas/system bars?
- Are Android physical-pixel insets converted to CSS px and applied only once?
- Is the top brand/header spacing compact with no unexplained blank area?
- Does it remain consistent with the rest of the app?
- Has any proposed deviation been explicitly approved by Mike?

If any required answer is **no**, the UI is not compliant.

## 17. Change record

**2026-09-19 — Version 1.2 — Product Brand System Integration**  
Mike approved the new Grassroots Club Hub brand family built around the grass-style **O**, with the exact tagline **CONNECT • ORGANISE • GROW THE GAME**. Version 1.2 retires the old shield/legacy-tagline lock-up, defines the primary/reverse/mark/icon/banner asset family, and establishes where platform identity stops and verified club identity begins. Product branding owns launcher, splash, authentication, onboarding and About surfaces; signed-in club/team surfaces continue to use the verified club badge, with the Grassroots Club Hub mark only as a neutral missing-badge fallback.

**2026-09-19 — Version 1.1 — Responsive & Imagery Corrections**  
Following installed-device review of v2.2.5, Mike rejected the remaining blank header spacing, low-resolution/blurred hero output and awkward screen-size adaptation. Version 1.1 makes the following requirements explicit: minimum 1600 px hero sources (1920+ preferred), compact single-application safe-area handling, no duplicate slogan treatment, no second decorative photo footer, short-screen scrolling, and explicit foldable/tablet/landscape layouts. These are corrections to the governing standard, not optional refinements.

**2026-09-19 — Version 1.0**  
Mike designated the app-wide green/white, realistic-football, responsive design shown in the approved visual references as the exact basis for Grassroots Club Hub moving forward. No deviations or exceptions are permitted without explicit discussion and agreement.
