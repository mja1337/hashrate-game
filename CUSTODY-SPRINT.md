# Custody sprint: rolling notes

A living list. Every workstream adds to **Open** whatever it noticed and did not fix, moves things to **Done**
when they land, and records any decision that changes the plan. Read this before starting the next workstream.

Plan: five workstreams, built and reviewed one at a time. Nothing is pushed until the user says so.

| # | Workstream | State |
|---|---|---|
| 1 | The bill is a custody event (reach, fetch the reserve, rush, fee by weight) | pushed |
| 2 | Places (devices and backups live somewhere; incidents hit places) | pushed |
| 3 | People (key holders are staff; Security Officer; rotation) | in progress |
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
| 2 | Confirm on the Pixel 8a that the 3D floor no longer reverts (cause was throwaway WebGL probes; fixed and pushed) | 3D fix | the user, after trying it |
| 3 | Market card "deposit from reserve" line (days and fee shown where you deposit) | WS1 | WS4, with the Market card changes |
| 6 | Pool payouts still use a flat fee that ignores the date, while spending from cold is priced by the real rate. Making payouts date-aware changes early-game economics, so it needs tuning | WS1 | WS4, once loans and fees are being looked at together |
| 9 | `settlementModal` is a base string patched by a chain of `.replace()` calls pinned by exact-text contracts; fragile. Consider one builder | WS1 | after the sprint |
| 10 | Module budget: `simulation.js` 67.0K, `render.js` 66.6K, `actions.js` 66.3K, `mine-market.js` 66.8K of 70K | cross-cutting | every workstream |
| 12 | Hot wallet stays single-key and instant; a hot-wallet policy is out of scope | plan | decide after WS4 |
| 13 | Bank-box seizure after regional bans (uses the existing `fx` event hook) | plan | follow-up |
| 18 | `key.exposed` (a stolen seed backup) is only cleared by unassigning that key; WS3 adds a real rotation that charges the sweep fee | WS2 | **WS3, next** |

## Closed in the fix-up pass (before pushing WS1 and WS2)

| # | Point | Resolution |
|---|---|---|
| 1 | Push the unpushed commits | pushed |
| 4 | Rush (3x fee) and the 5% buffer on the reserve | kept. The buffer covers the exchange fee and book impact; 3x is a premium, not a calibration. Revisit only if play shows it is never worth taking |
| 5 | A receiver sold cold coins no wallet could sign for | **fixed**: a forced sale takes cold only if the wallet could sign. New rule, mutation-tested |
| 7 | Old custody toasts not silent-tick aware | **fixed**: the signer-lost and phishing notices respect a catch-up. New contract |
| 8 | `ARCHITECTURE.md` omitted seven modules | **fixed**: losses, facilities, fleet-ops, connectivity, immersion, recap, render-queue |
| 11 | Topbar scrolled away between 801 and 900px | **fixed**: sticky up to 900px, with the tab row and the Mine section bar offset by the measured height. Checked at 850px |
| 14 | Place numbers (incident rates, access days, 1.8x, 35-75%) | kept as first-pass. No evidence yet that they are wrong; revisit with play evidence at stock-take 2 |
| 15 | No theft in transit | decision: not modelled; a journey is a delay, not a risk. Add only if it is missed in play |
| 16 | A stolen signer alone does nothing | decision: correct, devices are PIN-protected |
| 17 | New things always start at the mine | decision: kept. The extra trip is the lesson |
| 19 | Fuzzer reached the place machinery only by luck | **fixed**: every run starts with a configured 2-of-3 across three places and a wallet with coins |
| 20 | Relocation toast not silent-aware | won't fix: one rare toast, and the case that matters raises a loss modal |

## Done

- Auto-sell removed; settlement is a manual decision (`b6a45c6`).
- 3D floor: throwaway WebGL probe cached, lost context rebuilt, 10-second notice (`b6a45c6`).
- Mempool card fixed height; phone header sticky (`baefc78`).
- WS1: reach, fetch the reserve, rush, fee by weight and coin count, cold-spend review, in-flight coins counted,
  clock-stopped guard (`2146564`).
- Fix-up pass: a latent bug found by the fuzzer, where miners lost in a facility move or seized by a receiver left a stale
  "manually stopped" count behind, so buying that machine later would bring them back stopped. Clamped in both places.
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
