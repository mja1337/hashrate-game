# Custody sprint: rolling notes

A living list. Every workstream adds to **Open** whatever it noticed and did not fix, moves things to **Done**
when they land, and records any decision that changes the plan. Read this before starting the next workstream.

Plan: five workstreams, built and reviewed one at a time. All five are pushed.

| # | Workstream | State |
|---|---|---|
| 1 | The bill is a custody event (reach, fetch the reserve, rush, fee by weight) | pushed |
| 2 | Places (devices and backups live somewhere; incidents hit places) | pushed |
| 3 | People (key holders are staff; Security officer; rotation) | pushed |
| 4 | Counterparties (posture pricing, coin-theft cover, audit, BTC-secured loan) | pushed; stock-take 2 done |
| 5 | One Treasury tab | pushed |

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

Everything else that was open has been resolved; see the next section.

## Resolved after the sprint (the "get them all resolved" pass)

| # | Point | Resolution |
|---|---|---|
| 6 | Pool payouts used a flat fee that ignored the date | **Fixed.** Every ordinary payment and pool payout is priced at 250 vB x the day's rate. Before 2017 a fixed-fee floor (80 sat/vB, which is exactly the 0.0002 BTC this game always charged) keeps the early economy unchanged; from 2017 the market sets it, so December 2017 costs about four times the old figure and 2025 about 1/20th. Node discounts and the 1.35x quorum premium are kept. Two rules: early years unchanged and spike/quiet/node ordering. |
| 9 | `settlementModal` was a template patched by a chain of `.replace()` calls | **Fixed.** `src/ui/enhance/settlement.js` builds it from a list of options; the reserve and loan cards sit at the head. A contract requires every option's action to be handled. |
| 10 | Module budget | **Eased.** `applyEvent` -> `event-effects.js`, `transactionPreview` -> `ui/transaction-preview.js`, `fleetServicingVisual` -> `ui/enhance/servicing.js`, and the settlement modal left `render.js`. simulation.js 65.3K, actions.js 57.3K, mine-market.js 58.4K, render.js 60.8K of 70K. |
| 12 | Hot wallet stays single-key | **Decided, not built.** A hot wallet is the online convenience balance, and the game's lesson is to keep it small, not to give it a quorum. Cover, the reserve strip and the posture ladder already price it. A policy for it would be a second custody model with no decision attached to it. |
| 13 | Bank-box seizure after regional bans | **Built.** The China ban of June 2021 can open a bank box when the mine is in Sichuan (40%, hash roll). Everything in it goes, steel included; enough seeds in it is a theft; cover excludes it. Other regions and an empty box are untouched. |
| 21 | A retired key's signer could not be a spare | **Built.** "Wipe the signer" frees it; the backup is untouched and the key stays retired. |
| 23 | The security officer's other job | Already done in WS4 (audits). |
| 24 | A rotation could not be rushed or started for you | **Rush built** (half the days, never under two, 3x the sweep fee). Starting one automatically was **rejected**: it spends money and needs a choice of signer. The dismissal notice opens the Custody section where the rotate buttons are highlighted. |
| 28 | One loan, no partial repayment | **Partial repayment built** (quarter, half, all: the same share of the coins comes back and the loan to value is unchanged). One loan at a time is a **decision**: the two lenders' terms differ and the call logic stays readable; repay part, top up and re-borrow covers the need. |
| 29 | Only Celsius modelled | **Built.** A pledge goes to a named lender (Celsius, Voyager, BlockFi fail on their 2022 dates; Nexo and Ledn survive); only that lender's pledges are lost. Quorum loans have no lender to lose. Two new dated events. |
| audit | The audit ($4,000, 14 days) and the posture discounts were left first-pass | **Checked.** At 0.35% cover the audited tier saves about 0.14% of holdings a year and the loan discount 0.1% of principal a month (1.2% a year), so an audit pays for itself only above roughly $3M held or $330k borrowed. That is the intent (a certificate is for a big operator), so the numbers stay. |

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

**Decided with the user, and built:** a bank box dominated because nothing made the safest place cost anything where it hurts.
Restoring a key from a backup now takes the backup's access days (two from a bank or a trusted person's house, one from
home, none at the mine or with no place recorded), during which the wallet cannot sign with that key. A fire just before a
bill now makes the distance matter, and an old save restores as instantly as it always did.

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
- WS5: one Treasury tab with Market, Custody and Finance as sections; every old tab name resolves through `openTab()`; a
  position strip on all three; the dashboard's custody card and the payout card read the keys and the reserve.
- Restoring a key takes the backup's access days (the user's call after stock-take 2).
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
- The Treasury's strip and section bar are children of the content, not wrapped together: a sticky bar sticks inside its
  parent, and a wrapper only as tall as the strip released it a screen later. Found in the browser; the contracts could not
  have seen it.
- The Mine tab turns its section bar static on phones. The Treasury's stays sticky there, with its hint line hidden, because
  three compact buttons do not cost what four stacked ones do.
- Old names resolve in the click handlers, not at each call site, so a future toast that says "custody" works without anyone
  remembering. The contract that scans every tab name (more than seventy toasts link to the old names) is what keeps that true.
