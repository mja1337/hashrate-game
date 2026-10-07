# Custody sprint: rolling notes

A living list. Every workstream adds to **Open** whatever it noticed and did not fix, moves things to **Done**
when they land, and records any decision that changes the plan. Read this before starting the next workstream.

Plan: five workstreams, built and reviewed one at a time. Nothing is pushed until the user says so.

| # | Workstream | State |
|---|---|---|
| 1 | The bill is a custody event (reach, fetch the reserve, rush, fee by weight) | committed locally `2146564` |
| 2 | Places (devices and backups live somewhere; incidents hit places) | committed locally, awaiting stock-take 1 |
| 3 | People (key holders are staff; Security Officer; rotation) | not started |
| 4 | Counterparties (posture pricing, coin-theft cover, audit, BTC-secured loan) | not started |
| 5 | One Treasury tab | not started |

## When to take stock

Not on a timer. At the seams, where a later workstream *consumes* what an earlier one built, because that is where a
wrong number or a wrong shape gets expensive.

1. **After WS2, before WS3.** Places change signing time (access days replace the flat per-signer day), loss risk and
   what a fire can destroy. WS3 and WS4 both lean on that, and the numbers (incident rates, access days, bank-box
   fee) should be set by simulation and looked at together with WS1's fees *before* people and loans are layered on.
2. **After WS4, before WS5.** Everything with UI exists by then, and WS5 only re-hosts it. This is the moment to walk
   the whole flow as a player (short on cash, reserve in a vault, loan, margin call) and decide the Treasury layout
   from what actually exists, not from what was planned.
3. **At the end,** a full simulated run, the old-save fixture, and the phone.

Any of these also triggers an early stop-and-review: a module ceiling about to be broken, a contract rewrite larger than
the feature, a number that cannot be made to behave in simulation, or a decision the plan did not anticipate.

## Open (to action)

| # | Point | From | When |
|---|---|---|---|
| 1 | Push the unpushed commits (`baefc78` mempool + phone header, `2146564` WS1) so the phone gets them | WS1 | when the user says |
| 2 | Confirm on the Pixel 8a that the 3D floor no longer reverts (cause was throwaway WebGL probes; fixed and pushed in `b6a45c6`) | 3D fix | after the user tries it |
| 3 | Market card "deposit from reserve" line (days and fee shown where you deposit) | WS1 | WS4, with the Market card changes |
| 4 | Tune Rush (3x fee) and the 5% buffer on how much BTC the settlement card asks for | WS1 | stock-take 1 |
| 5 | `sellControlledBtc` (receivership) drains cold storage with no signing; decide if a forced seizure should respect distance | WS1 | WS2 or WS3 |
| 6 | Pool payouts still use a flat fee that ignores the date; the payout-threshold comment claims fees move with the year | WS1 | WS4, or its own small change |
| 7 | Two old custody toasts are still not silent-tick aware (`advanceCustodyRisks`, the entropy drain). Place incidents and journeys are | WS1 | housekeeping |
| 8 | `ARCHITECTURE.md` still omits `losses`, `facilities`, `fleet-ops`, `connectivity`, `recap`, `render-queue`, `immersion` | WS1 | housekeeping, end of sprint |
| 9 | `settlementModal` is a base string patched by a chain of `.replace()` calls pinned by exact-text contracts; fragile. Consider one builder | WS1 | after the sprint |
| 10 | Module budget: `simulation.js` 66.8K, `render.js` 66.6K, `actions.js` 66.2K, `mine-market.js` 66.8K of 70K | cross-cutting | every workstream |
| 11 | Between 801 and 900px the topbar still scrolls away (the tab row sticks on its own there) | phone header | low priority |
| 12 | Hot wallet stays single-key and instant; a hot-wallet policy is out of scope | plan | decide after WS4 |
| 13 | Bank-box seizure after regional bans (uses the existing `fx` event hook) | plan | follow-up |
| 14 | **Tune the place numbers** (see below): incident rates, access days, the 1.8x correlation penalty, the 35-75% strand share | WS2 | stock-take 1 |
| 15 | Nothing can happen to something on a journey except at a border; no theft in transit | WS2 | only if it is missing in play |
| 16 | A stolen signer on its own does nothing (PIN-protected). A thief who also knew the PIN would be a different incident | WS2 | probably leave |
| 17 | New devices and backups always start at the mine; there is no "ship it to" choice at purchase | WS2 | stock-take 1: does the extra trip annoy? |
| 18 | `key.exposed` (a stolen seed backup) is only cleared by unassigning that key; WS3 adds a real rotation that charges the sweep fee | WS2 | WS3 |
| 19 | The fuzzer only reaches the place machinery once custody hardware exists (2014+), and only if a run happens to order it | WS2 | consider seeding the fuzzer with a configured wallet |
| 20 | `custodyOnRelocation` toasts are not silent-aware (arrival is not passed `silent`) | WS2 | low |

## Done

- Auto-sell removed; settlement is a manual decision (`b6a45c6`).
- 3D floor: throwaway WebGL probe cached, lost context rebuilt, 10-second notice (`b6a45c6`).
- Mempool card fixed height; phone header sticky (`baefc78`).
- WS1: reach, fetch the reserve, rush, fee by weight and coin count, cold-spend review, in-flight coins counted,
  clock-stopped guard (`2146564`).
- WS2: places (the mine, home, bank box, trusted person), fire/flood/break-in incidents by hash roll, signing days from
  where the keys are, journeys, descriptor copies, restore-from-backup, borders on fleet relocation, the places card.

## Decisions

- One Treasury tab, built last, with an alias layer so old tab ids keep working.
- The BTC-secured loan is a new product, not a pricing change (WS4).
- Key holders: owner, treasurer, field technician, and a new Security Officer.
- New incident rolls use a pure hash roll of the seed, not `nextRand()`, so existing seeded runs do not shift.
- `undefined` place means "unrecorded" and must behave exactly as before, because 15 existing custody rules depend on it.
- A descriptor can be copied, a seed backup cannot (WS2). Reason: the descriptor is public information, and without copies a
  quorum could never be made fire-safe; a seed backup is a secret, and a second copy of it is a second thing to steal.
- "Fragile" means correlated, not lone: losing one place ends the wallet while losing any single item there would not.
  A lone copy is a different problem and the readiness card already reports it (found when an unrecorded save was flagged).
- Stranded coins take the same 35-75% of self-held BTC that the monthly "nobody can spend these" accident always took, so a
  place incident and a random accident cost the same.

## Numbers to look at in stock-take 1

All modelled, none historical. Monthly chances per place, and what they mean over a year and over a 17-year run:

| Place | Fire | Flood | Break-in | Per year | Access | Fee |
|---|---|---|---|---|---|---|
| The mine (tier 3+) | .15% | .10% | .20% | ~5% | 0 days | none |
| Home | .10% | .07% | .15% | ~4% | 1 day | none |
| Bank deposit box | .01% | .01% | .005% | ~0.3% | 2 days | $15/month |
| Trusted person | .08% | .06% | .10% | ~3% | 2 days | none |

A run that keeps everything at the mine has roughly a 60% chance of at least one incident over seventeen years (70% in a
house or garage, where break-ins are 1.6x likelier; 30% in a campus, where they are 0.4x). Questions for the review:
is one incident per run the right frequency, are the access days enough to make a bank box a real trade, and is a 1.8x loss
risk the right price for putting everything in one place?
