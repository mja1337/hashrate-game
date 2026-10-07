# Custody sprint: rolling notes

A living list. Every workstream adds to **Open** whatever it noticed and did not fix, moves things to **Done**
when they land, and records any decision that changes the plan. Read this before starting the next workstream.

Plan: five workstreams, built and reviewed one at a time. Nothing is pushed until the user says so.

| # | Workstream | State |
|---|---|---|
| 1 | The bill is a custody event (reach, fetch the reserve, rush, fee by weight) | pushed |
| 2 | Places (devices and backups live somewhere; incidents hit places) | pushed |
| 3 | People (key holders are staff; Security officer; rotation) | committed locally, awaiting review |
| 4 | Counterparties (posture pricing, coin-theft cover, audit, BTC-secured loan) | committed locally; stock-take 2 done |
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
| 6 | Pool payouts still use a flat fee that ignores the date, while spending from cold is priced by the real rate. Making payouts date-aware changes early-game economics, so it needs tuning | WS1 | still open: decided not to change early-game economics inside a custody workstream |
| 9 | `settlementModal` is a base string patched by a chain of `.replace()` calls pinned by exact-text contracts; fragile. Consider one builder | WS1 | after the sprint |
| 10 | Module budget: `simulation.js` 67.0K, `render.js` 66.6K, `actions.js` 66.3K, `mine-market.js` 66.8K of 70K | cross-cutting | every workstream |
| 12 | Hot wallet stays single-key and instant; a hot-wallet policy is out of scope | plan | decide after WS4 |
| 13 | Bank-box seizure after regional bans (uses the existing `fx` event hook) | plan | follow-up |

| 21 | After a rotation the old signer still holds the retired key, so it cannot serve as a spare. A real operator wipes it. Needs a "wipe this signer" action | WS3 | small follow-up; low priority |
| 23 | The security officer's other job (running an audit) arrives with WS4. Today the role only holds a key and halves insider risk | WS3 | WS4 |
| 24 | A rotation cannot be rushed, and does not offer to start itself when somebody is dismissed | WS3 | only if play shows it is missed |

| 28 | Only one loan against coins at a time, and no partial repayment. Both are simplifications | WS4 | only if play shows it is missed |
| 29 | The lender-failure event applies to one real episode (Celsius, 12 June 2022). Voyager and BlockFi are not modelled separately | WS4 | probably leave |
| 30 | Cover and the loan are only on the custody tab; the Finance tab still shows only migration cover and the operating loan | WS4 | WS5 puts them together |

## Stock-take 2

Measured, not argued: the engine's own functions run over the real price series and many seeded runs
(scripts were throwaway; the findings and the rules that now pin them are below).

| Question | Finding | Decision |
|---|---|---|
| How often does a place incident reach a player? | Everything at the mine on paper: 49% of runs over 12 years have an incident, 31% strand coins, 18% have coins stolen. Steel at the mine: 23% (break-ins only). Signer at the mine with steel in a bank box: **0.75%**. | Rates kept. About one incident per run for the careless is the intent. |
| Is a bank box a real trade-off? | **No.** Backups never need to be fetched to sign, so the only cost of the safest place is $15 a month, and it dominates. Access days only bite for SIGNERS. | Left as it is, and raised below as a design question. |
| How fast does an exposed key get swept? | Single signature, no officer: 40% within 30 days, 46% within 90, 77% within 180, all within a year; median 113 days. With an officer: 27% / 46% / 67% / 99%. Half hostile (46% in the sample), half patient. | Kept. It is the shape asked for. The hostile and patient caps are never reached before the person has acted, so they do not matter. A spare signer takes 9-18 days to arrive, so a player without one is swept before rotating roughly one time in six. |
| Is coin cover worth buying? | **No, by a mile.** At 1.5% a year the premium was 17 times the expected payout for a player 50% hot, 92 times at 20% hot, 281 times in a 2-of-3. | **Cut to 0.35% a year at a strong posture.** Now about 4 times the expected payout for a hot-heavy player and 22 times for a careful one: a real decision for the first and rightly not worth it for the second. A rule pins "2 to 60 times", not the number. |
| How often does a loan against coins end in a sale? | Weekly starts 2018-2025, held a year, no action. Pledge at the limit: 24% called, **17% sold**. Collaborative at the limit: 29% called, **30% sold**. Call-to-sale gap is only about 6 points of price, so in a crash the fortnight rarely matters. | The remedy in the sale notice, "borrow well below the limit", **could not be done**: principal was always the full loan to value. **Added a loan size: borrow all it allows, 80%, 60% or 40% of that.** At 60% of the limit the one-year sale rate is **2% (pledge) and 4% (collaborative)**. Default is 60%. |
| Does the player get warning? | 65% of eventual sales came less than a week after the loan first reached 70%. | **Added a notice five points before the call**, cleared when the loan recovers. |
| What does a bill-paying loan do? | It pledged just enough to start at the limit, the worst moment to be at it. | **Settlement loans now start at 60% of the limit.** |
| Does borrowing make a player richer? | Yes, for the operating loan: net worth ignored it (open point 25). | **Fixed.** `netWorth()` subtracts both. |

Two numbers I could not settle from data and have left first-pass: the audit ($4,000, 14 days) and the
posture-to-premium and rate discounts. Both are small next to the figures above and nothing in the data argues for
moving them.

**A design question for the user, not decided here:** a bank box dominates because nothing makes the safest place
cost anything where it hurts. The honest fix is that restoring a key from a backup should take the backup's access
days (two days from a bank, none at the mine), so a fire just before a bill makes the distance matter. It is a new
mechanic, not a number, so it is not in this pass.

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
- WS4: the operating loan's rate is one function; custody posture (none, basic, strong, audited) with named findings;
  audits run by the security officer; coin cover priced and paid by posture, refusing neglect, paid inside
  `reportCoinLoss`; two ways to borrow against coins (collaborative custody and a full-custody pledge) with margin calls,
  liquidation, interest in the bill, both usable to pay a settlement; the 2022 lender failure; the Market's reserve note.
- Stock-take 2: cover repriced from 1.5% to 0.35% a year; loans can be sized below the limit and warn five points before a
  call; settlement loans start at 60% of the limit; net worth subtracts the operating loan.
- WS3: holders (owner, treasury manager, security officer, field technician), dismissal exposes every key a person ever
  knew, insider risk (a daily hazard that rises every day: half hostile and likely to act within a month, half patient and silent for a quarter; halved by a security officer; only if the exposed keys alone satisfy the wallet),
  rotation as a job (new key, real sweep fee, days, consolidates to one coin, descriptor re-recorded), busy technicians a
  day later to sign, a warning on the staff card, retired keys cannot come back.
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
- Exposure does not stop the owner signing (a deviation from the plan, which said it should drop `ready`). A former employee
  knowing a seed is a risk, not an inability, and blocking the owner would punish the one person who can fix it.
- Rotation keeps the old key exposed, and the old wallet in force, until the sweep completes. The coins are not safe the
  moment you click, only when the days have passed.
- `knownBy` is permanent: handing a key back does not make the last holder forget it.
- The insider risk is a clock, not a monthly roll (the user's direction): the key stays usable and the chance of a sweep is
  rolled every day and rises every day. Half of exposures are hostile (more likely than not inside a month), half patient
  (nothing for 90 days, then climbing). The player is shown the blended chance and never which kind it is. Having been
  paid once, the clock starts again from nothing.
- Cover and loans price the same ladder. A better posture is cheaper and pays more in cover, and unlocks the lender that
  charges least; a wallet a lender will not co-sign can still pledge from the hot wallet, at a price.
- A pledge that is liquidated is reported as a seizure and a lender that fails as a counterparty loss, because that is what
  each is: the first is a debt being collected, the second is coins held by a company.
- The loan against coins is subtracted in net worth and the operating loan is not (open point 25). The first was needed to
  stop borrowing making a player richer; the second is a pre-existing gap I did not widen into this workstream.
