# Hashrate project structure

`index.html` is deliberately only the application shell. Keep implementation code out of it.

## Ownership

- `historical-data.js` — generated, immutable runtime history. Rebuild it with `scripts/build-historical-data.mjs`; do not hand-edit it.
- `src/config/timeline.js` — protocol dates, opening constants, treasury policies and scoring eras.
- `src/data/network.js` — fallback price/hash/transaction series, pools and the recorded-data bindings.
- `src/data/hardware.js` — miner specifications and spare parts.
- `src/data/operations.js` — facilities, regions, connectivity, energy contracts and staff.
- `src/data/progression.js` — learning, skills, nodes, securities, donations and optional scenarios.
- `src/data/content.js` — balance scenarios, release notes and historical story events.
- `src/data/glossary.js` — the canonical terminology, its searchable aliases and the Method chapter each term points at.
- `src/engine/operator.js` — experience, operator levels and the best-share record. Loaded **before** `simulation.js`, whose state migration calls `normalizeXp()` at the top level.
- `src/engine/maintenance.js` — spare parts, fault attribution, service jobs and the hands-on repair puzzles.
- `src/engine/pools.js` — pool selection, market share, fees and payout schemes (FPPS / PPS / PPS+ / PPLNS / TIDES).
- `src/ui/notify.js` — transient toasts and the bad-event impact effect; presentation rather than simulation.
- `src/ui/art.js` — per-facility mining-floor and spare-part illustration.
- `src/engine/history.js` — interpolation and historical/protocol lookup functions.
- `src/engine/thermal.js` — cooling capacity, active heat load, room temperature and thermal stress.
- `src/engine/nodes.js` — node power, synchronization, independent verification and Lightning capability.
- `src/engine/simulation.js` — state, migrations, economics, settlement, ticking and live refresh.
- `src/engine/actions.js` — player mutations, transactions, imports and exports.
- `src/ui/presentation.js` — formatting, charts and reusable visual helpers.
- `src/ui/tabs/` — base tab markup split into Dashboard, Mine, Ledger, Market, operations and Method ownership.
- `src/ui/enhance/` — post-render visuals split into Mine/Market, custody and operating-system ownership.
- `src/ui/live.js` — the cheap per-tick DOM patches for the header, charts and live tab panels; presentation rather than simulation.
- `src/ui/render.js` — modal, sidebar and application-shell rendering.
- `src/app/events.js` — delegated DOM events.
- `src/app/bootstrap.js` — compatibility adjustments and startup.
- `src/styles/app.css` — all application styling and responsive rules.

These are ordered classic scripts so the rebuild preserves existing save compatibility and avoids a risky gameplay rewrite. New code should be placed in the narrowest owning file. Do not add another script tag without updating the structural contract.

## Safety checks

Run these before handing off a change:

```powershell
node scripts/check-project-structure.mjs
node scripts/check-ui-contracts.mjs
node scripts/check-historical-data.mjs
```

The checks enforce dependency order, external assets, module size, unique Mine purchase quantities, historical-series integrity and JavaScript syntax.
