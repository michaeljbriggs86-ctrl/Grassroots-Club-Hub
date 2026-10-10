# PitchKind web rebuild (branch rebuild/domain-core)

STATUS: WRITTEN + TESTED at source level. Nothing here is BUILT into the web bundle or DEPLOYED-LIVE.

- `src/domain/`: pure TypeScript, no DOM. Feed-to-team fixtures, mini Cup groups, upcoming events,
  event keys, access table (DRAFT), youth public-results guard.
- `tests/domain.test.ts`: run with `npm test` (Node 22 type stripping, no build step).
- `tests/legacy_parity.mjs`: differential check against legacy `app.js` on real feed data.
  Run: `node --experimental-strip-types web/tests/legacy_parity.mjs` from the repo root.

Known gaps: `npm install` was unavailable when written, so `@types/node` is not installed and tests are
not type-checked. Only `src/` is type-checked (`tsc --noEmit`). The access table must be reconciled with
the live Supabase RLS policies. Deliberate difference from legacy: `ageNumber("U10X")` is 10, not 0.
