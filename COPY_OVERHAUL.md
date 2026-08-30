# Hashrate copy and help overhaul

Status: Phases 1–5 complete. Phase 6 is in progress: Method, the glossary, the procedural sandbox and terminology normalization are done; the remaining copy contracts and the full editorial walkthrough matrix are outstanding.

This document is the source of truth for rewriting the game's introduction, interface copy, contextual help, feedback, historical storytelling and technical reference material. Update it when copy conventions, scope or decisions change.

## Product promise

> Start with one computer. Run a Bitcoin mining operation through its entire history. Keep it profitable, solvent and secure as the technology and network change.

The game should be understandable to a curious player who knows that Bitcoin exists but does not yet understand mining. Technical players should still be able to inspect the real concepts, formulas, historical data and modelling assumptions.

The answer is progressive disclosure, not removing technical depth.

## Outcomes

The overhaul is successful when:

- A newcomer can explain mining, cash, BTC and the next operating bill after five minutes.
- A new player can complete the first operating cycle without opening Method.
- Every tab immediately answers why it exists and what the player can do there.
- Every unavailable action explains the missing requirement and where to resolve it.
- Consequential actions preview their cost, delay and operational effect.
- Technical detail remains reachable within one interaction from the relevant mechanic.
- Historical facts, derived values and modelled mechanics remain clearly distinguishable.
- Difficulty comes from decisions and economics, not unexplained terminology.

## Audience model

### Curious newcomer

Knows Bitcoin is a digital asset. May not know how mining, wallets, exchanges, pools, difficulty or hash rate work. Needs purpose, consequences and a recommended next action.

### Informed Bitcoin user

Understands BTC, wallets and perhaps mining at a high level. Needs the operating relationships and historical context without being forced through elementary explanations repeatedly.

### Technical operator

Wants precise values, formulas, payout schemes, historical sources and modelling assumptions. Needs depth without making that depth the default reading level of every screen.

All three audiences use the same simulation. Beginner guidance is dismissible and contextual; the game should not maintain separate beginner and expert versions of its rules.

## Content layers

Every mechanic should be explainable at three levels.

1. **Interface:** short, concrete and actionable. Explain the consequence before specialist terminology.
2. **Contextual help:** answer “what does this mean?” and “why should I care?” beside the mechanic.
3. **Method/reference:** provide formulas, edge cases, historical sourcing and modelling rationale.

Example:

> **Network difficulty**  
> How hard the network currently makes it to find a block. As difficulty rises, the same machine earns less.

Contextual detail:

> Difficulty adjusts approximately every 2,016 blocks. This simulation uses the recorded historical difficulty for the current campaign date.

Method detail can then show the complete expected-yield formula and data source.

## Voice and style guide

### Voice

The interface should sound like an experienced operator coaching the player:

- Calm under pressure.
- Direct without being cold.
- Technically credible without showing off.
- Honest about uncertainty and modelling.
- Interested in the history without lecturing.
- Clear about consequences without scolding the player.

### Writing rules

- Lead with what happened or what the player needs to decide.
- Explain why it matters before explaining how it is calculated.
- Prefer one idea per sentence.
- Prefer concrete nouns and verbs: “This miner draws 1.4 kW” over “Additional electrical headroom is required.”
- Use “you” for player actions and “your operation” for the simulated business.
- Use specialist terminology when it is the correct term, then define it on first use.
- Expand an abbreviation on first use in a player journey: “full pay per share (FPPS).”
- Put exact formulas in contextual help or Method, not in primary instructions.
- Use contractions in conversational guidance; avoid them in compact status labels.
- Avoid vague labels such as “unavailable,” “invalid,” or “limit” without a cause.
- Do not use humour when the player is losing assets, facing insolvency or repairing a failure.
- Do not imply that historical returns are a forecast or that BTC income is guaranteed.

### Information order

For instructional copy, use:

1. Current state.
2. Consequence.
3. Recommended action.
4. Technical detail, if requested.

For an action confirmation, use:

1. What will change.
2. Immediate cost or transfer.
3. Delay and ongoing cost.
4. Risk or reversibility.
5. Confirming action.

For a blocked action, use:

1. Plain-language reason.
2. Exact missing amount, capacity, date or prerequisite.
3. Where or how to resolve it.

### Tone examples

Avoid:

> Facility limit. Your installed fleet plus outstanding orders would exceed capacity.

Prefer:

> **This site cannot support another miner.** You need 1.4 kW more electrical capacity. Pause equipment or move to a larger facility.

Avoid:

> Miner order placed. 3 × Antminer via supplier: ETA 14 days · 18% delay risk.

Prefer:

> **Three miners ordered.** They are due in 14 simulated days and must be commissioned before they earn BTC. Their floor space and power capacity are reserved now. The supplier has an 18% modelled delay risk.

## Terminology and naming

Use these terms consistently across interface, help and Method.

| Preferred term | Meaning and usage | Avoid in primary copy |
| --- | --- | --- |
| Bitcoin | The network, protocol or system | “the Bitcoin” |
| bitcoin | Units in prose when no amount is shown | Capitalising every use |
| BTC | A displayed amount or balance | “coins” when a precise balance matters |
| Mining | Using computation to compete for blocks | Assuming “hashing” is understood |
| Hash rate | Computational work performed per second | “Hashrate” in prose; keep the product name Hashrate |
| Network difficulty | How difficult the network makes block discovery | “Difficulty” alone on first use |
| Block reward | Subsidy plus transaction fees received for a block | Treating subsidy and fees as identical |
| Solo mining | Mining independently with high payout variance | “Solo” without context on first use |
| Mining pool | A service that combines work and distributes rewards | Unexpanded scheme abbreviations |
| Liquid cash | Fiat available to spend now | Liquidity when cash is specifically meant |
| Starting Liquidity | The named pre-run control for opening liquid cash | Starting capital, intro cash |
| Cash runway | Estimated months before current cash is exhausted | “Runway” alone on first use |
| Operating bill | The monthly settlement of recurring costs | Settlement when teaching the first bill |
| Hot wallet | A wallet connected to an online device | Assuming “hot” implies online risk |
| Cold storage | Keys kept away from an online device | Cold wallet/cold storage interchangeably on one screen |
| Self-custody | Holding the keys that control bitcoin | “Controlled” without identifying keys |
| Custodial balance | BTC or claims held by an exchange or custodian | Calling it self-held BTC |
| Full node | Software that independently validates Bitcoin rules | Implying a node automatically secures keys |
| Lightning liquidity | BTC committed to Lightning channels | Yield, staking or interest |
| Electrical capacity | The site's available power | Power capacity and electrical headroom on the same screen |
| Floor capacity | Physical room for machines | Space units without explanation |
| Condition | Gradual equipment health from 0–100% | Health and condition interchangeably |
| Fault | A specific failed component | Treating low condition as a fault |
| Modelled | A gameplay assumption or simulated outcome | Simulated, estimated and modelled interchangeably |
| Recorded | Taken from the bundled historical dataset | “Real” when derived interpolation is involved |
| Derived | Calculated from recorded inputs | Recorded |

### Number and unit rules

- Use `$1,500`, not `$1500`.
- Show `/day` or `/month` beside recurring costs.
- Show both current and maximum capacity: `3.2 / 5.0 kW`.
- Use a space between a value and physical unit: `1.4 kW`, `22 °C` where layout permits.
- Use `BTC` for balances and transaction amounts.
- Define `MH/s`, `TH/s`, `PH/s` through contextual help before expecting comparison.
- Use “simulated day” when a delay could be confused with real time.
- Use percentages for player-facing risk; reserve multipliers for advanced detail.

## Player journey and teaching sequence

Teach concepts when they first become relevant, not all at the start.

| Moment | What the player should learn | Primary surface |
| --- | --- | --- |
| Before starting | The role, survival loop and effect of start settings | Introduction |
| First dashboard | Mining earns BTC; running the operation costs cash | Operator briefing |
| First time advance | Time creates revenue, costs and historical change | Dashboard |
| First bill forecast | Cash runway and the monthly operating bill | Dashboard / Finance |
| First hardware comparison | Hash rate, energy use, price and capacity | Mine |
| First new order | Delivery, reserved capacity and commissioning | Confirmation / Mine |
| First pool unlock | Reward timing, variance, scheme and fee | Pools |
| Market opening | BTC can become operating cash through a venue | Market |
| First BTC balance | Keys, hot wallet and custody risk | Custody / wallet setup |
| First facility constraint | Electrical capacity versus floor capacity | Mine / Facilities |
| First fault | Condition, faults, parts and repair workflow | Mine |
| First historical threat | History can change market, policy or custody risk | Event modal |
| First finance shortfall | Rescue options have lasting consequences | Settlement modal |
| End of run | What the player achieved and what shaped the result | Recap |

## Navigation purpose statements

Each destination should open with one clear job.

| Destination | Purpose statement | Primary player question |
| --- | --- | --- |
| Dashboard | See what needs attention now | What should I do next? |
| Mine | Buy, run and repair mining machines | Is my fleet competitive and healthy? |
| Pools | Choose how mining rewards arrive | Do I want steadier rewards or solo variance? |
| Market | Turn cash into BTC—or BTC into operating cash | Where can I trade, and what risk am I taking? |
| Custody | Decide who controls your bitcoin | Do I hold the keys? |
| Facilities | Find enough power and room for the fleet | Can this site support my next step? |
| Energy | Control the largest recurring operating cost | What does each unit of mining cost here? |
| Finance | Keep enough cash to pay the next bill | How long can the operation survive? |
| Learn | Study Bitcoin's history and earn knowledge | What can I learn from this era? |
| Tech | Turn knowledge into operating advantages | Which capability should I build next? |
| Ledger | Review what changed and why | Where did my assets and costs move? |
| Method | Inspect the simulation's rules and sources | How exactly is this calculated? |

## Reusable copy structures

### Page orientation

Each main tab should provide:

- **Purpose:** one sentence explaining what the page controls.
- **Situation:** one state-aware summary using the most important current value.
- **Next action:** one recommended action, if appropriate.
- **Why it matters:** one sentence describing the consequence.

### Operator briefing

The Dashboard should host a dismissible, state-aware briefing:

> **What needs attention**  
> Your laptop is mining, but a block may take time to arrive. You have enough cash for approximately 18 months of current costs.  
> **Recommended:** Let the simulation run and watch your next operating bill.

Briefings must be derived from current state, not a rigid tutorial sequence.

### Contextual definition

> **Term** — one-sentence plain-English definition.  
> Why it matters to this decision.  
> Optional link: “See the full calculation →”

### Blocked action

> **Action cannot continue.**  
> Specific reason and missing requirement.  
> Recovery action and destination.

### Successful action

> **Outcome.**  
> What changed immediately.  
> What happens next, including simulated delay or ongoing cost.

### Historical event

Every major event should separate:

1. **What happened** — concise historical account.
2. **Why it matters to Bitcoin** — network, market or social significance.
3. **What changes for your operation** — explicit gameplay effect or “context only.”

### Data provenance

Use the existing three-way distinction consistently:

- **Recorded:** bundled historical observation.
- **Derived:** calculated from recorded observations.
- **Modelled:** gameplay assumption or simulated outcome.

Explain these once during onboarding and expose definitions on demand. Do not repeat a long disclaimer on every card.

## Current copy-surface inventory

This is the implementation map for the rewrite. It identifies ownership rather than reproducing every literal string.

| Surface | Current owner | Content present | Main issue | Rewrite phase |
| --- | --- | --- | --- | --- |
| Introduction and run selection | `src/ui/render.js` | Six slides, difficulty and Starting Liquidity | Front-loads concepts; lacks a crisp role and survival loop | 2 |
| Wallet setup | `src/ui/render.js` | Dice ceremony and private-key explanation | Arrives before many newcomers understand custody relevance | 2 |
| Header, navigation and mobile groups | `src/ui/tabs/dashboard.js` | Live balances, 12 destinations, speed controls | Labels assume the information architecture is already understood | 3 |
| Dashboard | `src/ui/tabs/dashboard.js` | Priorities, fleet/network state, controls | Strong telemetry but weak first-session coaching | 2–3 |
| Mine base UI | `src/ui/tabs/mine.js` | Hardware cards, purchase controls | Dense economics and capacity terminology | 3 |
| Live floor and maintenance UI | `src/ui/enhance/mine-market.js` | Status, temperature, faults, orders, repairs | High cognitive load; mixes status, diagnosis and advanced detail | 3–4 |
| Pools | `src/ui/tabs/pools.js`, `src/engine/pools.js` | Schemes, variance, fees and timelines | Accurate but abbreviation-heavy for first-time miners | 3 |
| Market | `src/ui/tabs/market.js`, `src/ui/enhance/mine-market.js` | Venues, balances, quotes and trading | Assumes bid/ask, venue and custody knowledge | 3 |
| Custody | `src/ui/tabs/operations.js`, `src/ui/enhance/custody.js` | Wallets, nodes, threat lab, Lightning | Good depth; needs a simpler “who holds the keys?” entry layer | 3–4 |
| Facilities | `src/ui/tabs/operations.js`, `src/ui/enhance/operations.js` | Sites, regions, connectivity and operational risk | Business/engineering vocabulary arrives all at once | 3–4 |
| Energy | `src/ui/tabs/operations.js`, `src/ui/enhance/operations.js` | Tariffs, load, shocks and contracts | Primary choice is obscured by multipliers and formulas | 3–4 |
| Finance | `src/ui/tabs/operations.js`, `src/ui/enhance/operations.js` | Runway, loans, arrears, staffing and insurance | Needs clearer separation of cash, recurring cost and debt | 3–4 |
| Learn and Tech | `src/ui/tabs/operations.js`, `src/ui/tabs/method.js` | Learning queue, knowledge and skills | Needs stronger connection between learning and player decisions | 3 |
| Ledger | `src/ui/tabs/ledger.js` | Transaction and activity history | Technically clear; needs newcomer-friendly category definitions | 3 |
| Historical story and events | `src/data/content.js`, `src/engine/history.js`, `src/ui/render.js` | Era narratives and modal events | History, interpretation and mechanical consequence blur together | 5 |
| Hardware release alerts | `src/data/hardware.js`, `src/ui/render.js` | New-machine announcements | Feature lists need decision-oriented comparisons | 5 |
| Transaction confirmations | `src/engine/actions.js`, `src/ui/render.js` | Costs, transfers and execution | Needs consistent immediate/ongoing/reversible structure | 4–5 |
| Toasts and blocked actions | `src/engine/actions.js`, `src/engine/simulation.js`, `src/engine/maintenance.js` | At least 139 action/state feedback paths | Inconsistent causes, consequences and recovery advice | 5 |
| Settlement and failure states | `src/engine/simulation.js`, `src/ui/render.js` | Shortfall, rescue and receivership | High stakes; needs the clearest trade-off copy in the game | 5 |
| End-of-run recap | `src/engine/recap.js`, `src/ui/render.js` | Score, milestones and continuation | Explains result but can better narrate the player's operation | 5 |
| Method and technical reference | `src/ui/tabs/method.js`, `src/app/bootstrap.js` | Full rules, formulas and data snapshot | Large wall of text; currently performs both teaching and reference roles | 6 |

## Audit findings and rewrite priorities

### Critical

- The opening teaches screens and features before clearly teaching the player role and survival loop.
- The player reaches a dense dashboard without a state-aware first objective.
- High-impact concepts such as cash versus BTC, operating bills, hash rate and difficulty rely on assumed knowledge.
- Method is required to understand some mechanics but is too dense to function as onboarding.
- Many blocked actions report a condition without a recovery path.

### High

- Page introductions vary widely in purpose, tone and reading level.
- Technical abbreviations are often efficient for experts but unexplained for newcomers.
- Status cards mix primary decisions with formulas and provenance notes.
- Wallet setup is educational but poorly timed in the newcomer journey.
- Historical narrative sometimes mixes fact, interpretation and gameplay consequence in one paragraph.

### Medium

- Similar ideas use several names: capacity/headroom/load, condition/health, cash/liquidity, settlement/bill.
- Toasts vary between terse system messages and detailed operational explanations.
- Disabled buttons sometimes depend on browser-native `title` text, which is weak on touch devices.
- Uppercase metadata and terminal-style labels reinforce an alpha/debugging feel when overused.
- Several useful explanations repeat instead of linking to a canonical contextual definition.

## Delivery roadmap

### Phase 1 — Editorial foundation — complete

- [x] Define product promise and target audiences.
- [x] Define layered content model.
- [x] Establish voice, style and information-order rules.
- [x] Establish canonical terminology and unit conventions.
- [x] Map the player teaching journey.
- [x] Define page purposes and reusable copy structures.
- [x] Inventory copy surfaces, ownership and rewrite priority.
- [x] Record initial audit findings and acceptance criteria.

### Phase 2 — First-run experience — complete

- [x] Replace the six-slide opening with three decision-focused beats.
- [x] Rewrite difficulty and Starting Liquidity descriptions around player outcomes.
- [x] Add a dismissible state-aware Operator briefing to Dashboard.
- [x] Define the first-session guidance states and priority order.
- [x] Reframe wallet setup around receiving BTC and controlling private keys.
- [x] Add first-use definitions for mining, BTC, hash rate, network difficulty and operating bill.
- [x] Protect all four campaign openings with contract tests; visually walk through Standard and the materially different Impossible opening at desktop and mobile widths.

### Phase 3 — Core operating loop — complete

- [x] Standardize page orientation blocks.
- [x] Rewrite Dashboard, Mine and capacity guidance.
- [x] Rewrite Facilities and Energy around operating decisions.
- [x] Rewrite Pools around reward timing, variance and fees.
- [x] Rewrite Market and Finance around cash conversion and survival.
- [x] Rewrite Custody around key control and counterparty exposure.
- [x] Rewrite Learn, Tech and Ledger entry layers.

### Phase 4 — Contextual help system — complete

- [x] Add reusable expandable definitions and “How this works” links.
- [x] Add touch-accessible explanations for disabled controls.
- [x] Store dismissed beginner guidance in save-compatible state.
- [x] Connect each mechanic to a precise Method anchor.
- [x] Avoid duplicating full technical explanations in primary UI.

### Phase 5 — Events and feedback — complete

- [x] Standardize blocked-action, success, warning and confirmation structures.
- [x] Rewrite action and simulation toasts.
- [x] Rewrite transaction confirmations.
- [x] Separate fact, significance and gameplay effect in historical events.
- [x] Rewrite repair, settlement, failure and rescue messages.
- [x] Strengthen the end-of-run narrative.

### Phase 6 — Reference and editorial QA

- [x] Split Method into navigable, collapsible chapters with a clear distinction between player guidance, exact calculations, historical sources and modelling assumptions.
- [x] Add a searchable in-game glossary that defines canonical terms in plain English and links back to the relevant Method chapter.
- [x] Add a dedicated procedural-sandbox chapter covering what continues after the recorded history ends, what stops, and which values become modelled.
- [x] Rewrite the 2026 continuation decision and first sandbox briefing so players understand that no new recorded news or hardware is added, while price, network activity, difficulty, fees, block height and halvings continue procedurally.
- [x] Explain projected halvings as protocol-driven operational events, including their effect on subsidy and expected mining income, without presenting their modelled calendar dates as recorded history.
- [x] Correct projected subsidy calculations to use whole satoshis and add boundary checks for the first post-record halving and the 100-year endpoint.
- [x] Normalize terms, abbreviations, units, capitalization and recurring-cost notation across every primary, contextual and reference surface.
- [ ] Add automated copy contracts for legacy terms, required help patterns, procedural/recorded labels and sandbox-halving explanations.
- [ ] Complete desktop and mobile editorial walkthroughs covering onboarding, the operating loop, transactions, faults, historical events, settlement, the 2026 ending, sandbox continuation and the final recap.

## Phase 2 implementation record

Phase 2 deliberately changed the introduction and Dashboard only. This establishes the voice and validates the newcomer/expert balance before it spreads across the simulation.

Proposed opening beats:

1. **Run a mining operation through Bitcoin's history.** You begin with one computer. Mining can earn BTC, but electricity, equipment and time all have costs.
2. **Stay solvent while the network changes.** Better machines increase your chance of earning rewards. Operating bills continue whether rewards arrive or not.
3. **Choose your starting point.** The campaign date controls the era and available technology. Starting Liquidity controls how much liquid cash the operation has on day one.

Initial Operator briefing priority:

1. Critical settlement or insolvency risk.
2. Fleet unable to mine.
3. Active fault or unsafe temperature.
4. Facility capacity blocking progress.
5. Newly available hardware or pool.
6. First-session teaching objective.
7. General cash-runway or competitiveness advice.

Guidance yields to the settlement modal, never pauses the clock unexpectedly and never forces an action. Dismissals are stored per topic, so hiding one piece of advice does not permanently disable future guidance.

## Phase 3 implementation record

Every non-Dashboard destination now opens with the same four-part decision frame:

1. **What this page is for** gives the destination a plain-language purpose.
2. **Current situation** interprets the live campaign state instead of repeating a static introduction.
3. **Recommended next step** identifies the most useful decision on that page.
4. **Why it matters** connects the decision to BTC income, cash survival, capacity or control.

The frame is followed by four exact metrics, so newcomer guidance and operator precision remain visible together. Dashboard keeps its higher-priority Operator briefing rather than duplicating this block.

The operating-loop rewrite establishes these conceptual boundaries:

- Hash rate is mining work; electricity draw is the recurring cost attached to that work.
- A facility provides two distinct constraints: electrical capacity and floor space.
- Solo and pool mining change reward timing, variance and fees, not physical hash rate.
- BTC must be sold before it can pay a dollar bill; net worth is not the same as liquid cash.
- Self-held BTC is controlled by the player's keys; a venue balance is BTC held by another party.
- A node verifies network rules but does not control coins or create mining rewards.
- Learning creates knowledge, knowledge thresholds create points and Tech spends those points on lasting capabilities.
- Ledger is an audit trail for explaining balance changes, not another live dashboard.

The page-orientation contract covers all eleven non-Dashboard tabs. Desktop and 390 px mobile walkthroughs verified that the three guidance columns collapse cleanly into a readable sequence and that the metric strip remains scannable.

## Phase 4 implementation record

Every non-Dashboard destination now includes a collapsed **Terms and help** disclosure beneath its orientation metrics. Each disclosure defines three terms in one consequence-focused sentence and links to the relevant Method chapter for formulas, edge cases and modelling assumptions.

The contextual layer follows these rules:

- Definitions explain what the term changes for the player; they do not repeat the full Method treatment.
- “How this works” opens Method at a named chapter rather than dropping the player at the top of the manual.
- Recorded, derived and modelled values use the same short definitions everywhere.
- Page help is collapsed by default, so experienced players retain the compact operator view.
- Dashboard's first-use definitions remain part of the save-compatible dismissible Operator briefing.

Disabled action help no longer relies on mouse hover. Every disabled action button receives a visible, keyboard-focusable 34 px `?` control—40 px at mobile width—which opens the exact existing blocker text in a toast. Where an action has no specific title, the helper derives a useful explanation from its current/selected/locked label and falls back to the requirement card above. The original button remains genuinely disabled, and the explanation is also connected through `aria-describedby` for assistive technology.

Automated contracts cover the help map, all eleven Method destinations, disclosure structure, blocked-action event wiring, accessible descriptions and responsive styling. Desktop and 390 px mobile walkthroughs verified the disclosure layout, Method deep-link, disabled-control touch target and blocker toast.

## Phase 5 implementation record

Transient feedback now uses one semantic system instead of treating every message as a generic toast. Success, blocked action, warning, failure and milestone states each have a plain-language label, distinct visual treatment and suitable live-region priority. Feedback linked to another page names that destination, and completed BTC trades, transfers and miner sales state both the asset movement and resulting spendable balance. Delay, loss and missed-learning outcomes no longer appear visually as successful actions.

Consequential transactions now pause with a five-part review:

1. Nothing has moved yet.
2. What the player gives now.
3. What the player receives.
4. The operational consequence, including custody, delivery, recurring cost or irreversibility.
5. Locked reference values, fees and the resulting position.

Historical chapters separate **What happened**, **Why it mattered** and **Effect on your operation**. Events without a direct mechanic say so explicitly; custody failures, regional disruptions, rival liquidations and halvings name their exact modelled effect. Thirty-day market movement remains a separate “context, not causation” panel.

High-stakes operating feedback now leads with consequence and recovery. Fault messages name lost mining capacity and the part to repair. Settlement choices state both the immediate rescue and lasting cost; successful rescues report what was sold or borrowed; receivership reports seized assets, mining status and strike count. The end-of-run recap adds a plain-English assessment, the run's defining lesson and three evidence points for solvency, profitability and remaining BTC before the technical score breakdown.

Automated contracts cover semantic feedback kinds, transaction hierarchy, event boundaries, settlement consequences, repair language and recap structure. Desktop and 390 px mobile walkthroughs verified the transaction review, historical chapter and blocked-action alert. The visual pass also caught and corrected a halving event that initially inherited the generic “no direct rule change” fallback despite immediately reducing the block subsidy.

## Phase 6 planned implementation

Phase 6 should turn Method from a long manual into the canonical reference behind the contextual-help system. Its first view should provide a short table of contents and concise chapter summaries. Exact formulas, edge cases, provenance and source notes should remain available inside collapsed detail rather than dominating the initial reading experience.

Proposed Method structure:

1. **Start here** — the operating loop, cash versus BTC and the monthly operating bill.
2. **Mining and rewards** — hash rate, network difficulty, subsidy, transaction fees, solo variance and pool schemes.
3. **Fleet and facilities** — capacity, power, cooling, condition, faults, procurement and commissioning.
4. **Market, treasury and finance** — prices, fees, custody boundaries, runway, debt and settlement.
5. **Custody and verification** — keys, wallets, venues, nodes, Lightning and counterparty risk.
6. **Progression and scoring** — knowledge, skills, milestones, eras and Operator Score.
7. **Recorded history and sources** — bundled datasets, interpolation and event sourcing.
8. **Procedural sandbox** — post-2026 projections, assumptions, limits and the 100-year endpoint.

The glossary should be reachable from every contextual-help disclosure and should initially cover the canonical terminology table in this document. Definitions should stay short enough for a newcomer while linking to Method for formulas and exceptions. Search should match abbreviations such as BTC, ASIC, FPPS and PPA as well as their expanded names.

### Procedural sandbox copy requirements

The sandbox transition must state four things before the player continues:

1. The recorded historical feed ends on 08 August 2026.
2. No new historical chapters or hardware releases are invented after that date.
3. Price, network hash rate, network difficulty, transaction activity, fees, chain size and block height continue through deterministic modelled projections.
4. Bitcoin's subsidy schedule continues, so future halvings reduce mining income even though their exact in-game dates are projections based on a constant ten-minute block interval.

The first post-record halving is projected around April 2028 and reduces the subsidy from 3.125 BTC to 1.5625 BTC per block. Each subsequent halving should create an operational notification and Ledger entry that says **Projected protocol halving**, states the old and new subsidy, and recommends reviewing mining margin. These notices must not appear as recorded historical chapters.

The sandbox currently runs to approximately August 2126 and includes about 25 post-2024 halvings. By the endpoint the subsidy is approximately nine satoshis per block. The calculation must floor each subsidy to a whole satoshi, matching Bitcoin's indivisible accounting unit; fractional satoshis must not enter mining payouts, forecasts or displayed values.

Required sandbox contracts:

- The first projected halving occurs only after the historical cutoff and reduces 3.125 BTC to 1.5625 BTC.
- Projected halving notifications and Ledger entries are labelled modelled/procedural, never recorded.
- Mining reward and profitability calculations use the reduced subsidy immediately after each boundary.
- Subsidy values are whole satoshis throughout the 100-year continuation.
- The sandbox endpoint, approximately August 2126, remains finite and suppresses another continuation action.
- No new hardware release or historical-event chapter is generated after the recorded cutoff.

### Final editorial walkthrough matrix

The final pass should cover both 1440 px desktop and 390 px mobile layouts, with keyboard and touch-accessible controls checked where applicable:

- Standard first run and Impossible first run.
- First bill, first miner order, first pool choice and first BTC trade.
- Custody transfer, node prerequisite and a blocked action.
- Hardware fault, self-repair failure and successful repair.
- Historical event with a direct effect and one with context only.
- Cash shortfall, each rescue route and receivership.
- Historical ending, sandbox decision, projected halving and 100-year ending.
- End-of-run recap at both strong and weak scores.

The walkthrough should finish with a repository-wide language audit for legacy synonyms, unexplained abbreviations, recurring costs without `/month`, physical values without units, ambiguous uses of “liquidity,” and claims that blur recorded history with derived or modelled behaviour.

## Phase 6 implementation record

### Method as eight chapters

Method now opens as a table of contents over eight collapsible chapters rather than a numbered list of sixteen sections. Each chapter carries a one-line summary in the contents and on its own header, and each opens with a plain-language lead that states the idea before any formula appears. Only the first chapter is expanded by default.

Section numbering is gone, because chapters now carry the order. Every section id that contextual help depends on is written into the markup, replacing the runtime helper that identified headings by matching their text against prefixes such as `"7. Facilities"` — a coupling that would have broken the moment a heading was renumbered or reworded. Deep links now open the chapter they point inside before scrolling, since a collapsed `<details>` cannot be scrolled to.

Two accumulated `enhanceMethod` overrides in `bootstrap.js` were folded away as part of this. Eight of their eleven `innerHTML` string replacements were already dead against the Phase 1–5 copy; the three that still applied were folded into the source text, and the dataset provenance panel moved into the Recorded history and sources chapter, where it belongs. Method no longer rebuilds its own DOM twice after every render.

The chapter-level separation of guidance, calculation, provenance and modelling is in place: chapter leads carry the guidance layer, the sources chapter carries provenance, and the sandbox chapter carries the modelling boundary. Layering the *inside* of the denser sections — several are a single 1,700-character paragraph containing both the explanation and its formula — is editorial rewriting still to do.

### Searchable glossary

`src/data/glossary.js` holds 47 canonical terms, each with a one-or-two sentence plain-English definition, a set of search aliases and the Method target that carries the formula. Search matches abbreviations, their expansions and common synonyms against the same entry, so `fpps`, `full pay per share`, `ppa`, `power purchase agreement`, `asic`, `hashrate` and `sats` all resolve.

The glossary is a modal rather than a page, so a term can be looked up from wherever it confused the player without losing their place. It opens from the "Terms and help" disclosure on every non-Dashboard tab and from the Method contents; filtering happens in the DOM rather than through a re-render, so the search field keeps focus as the player types.

### The procedural sandbox

The continuation decision no longer offers a single sentence of small print. It now separates what stops at the cutoff, what continues as a deterministic model, and what continues because it is protocol, and the Method sandbox chapter carries the same three-way split in full. A dismissible Operator briefing repeats the boundary once the sandbox has started and links to that chapter.

Projected halvings are treated as operational events rather than historical ones. Each states its old and new subsidy, is labelled **Projected protocol halving** in both the notification and the Ledger, attributes its date to the constant ten-minute block interval that produced it, and recommends re-checking mining margin. None of them appear as recorded chapters.

The subsidy model was wrong and is now correct. `subsidyAt` computed `50 / 2**halvings`, which stays exact for the first nine halvings and then pays fractions of a satoshi: from April 2048 the tenth epoch should be 4,882,812 satoshis, not 4,882,812.5. Subsidies are now integer satoshis floored by halving, matching Bitcoin's own integer division, and reach zero rather than paying an impossible fraction. Displayed subsidies switch from BTC to satoshi notation below 0.001 BTC, so the late sandbox reads `9 sats` rather than `9e-8 BTC`.

### Contracts added

All six required sandbox contracts are in place and were mutation-tested against the original `50 / 2**n` model, which they catch at the 2048 boundary. They cover the first projected halving landing after the cutoff and taking 3.125 BTC to 1.5625 BTC, the 25 projected halvings before the endpoint, whole-satoshi subsidies at weekly resolution across the full 100 years, rewards using the reduced subsidy from the boundary itself, the nine-satoshi endpoint, and the absence of any event or hardware release dated after the cutoff. Further contracts cover the four required statements in the continuation decision, the sandbox briefing, the eight Method chapters and their static anchors, the deep-link reveal, and glossary coverage, aliases and Method targets.

### Terminology normalization

`hashrate` is now `hash rate` in all 28 player-facing uses. The product name keeps its spelling, as do the save keys, the export filename and the shipped release notes — a release note records what was written at the time, and a save key is an identifier, not prose.

`/mo` is now `/month` in all 23 recurring-cost displays. Both breakpoints were re-checked across ten tabs afterwards: the longer suffix clips nothing and introduces no horizontal overflow.

A legacy-terminology contract now walks every module and fails on either term outside its documented exemptions, with the offending line quoted. It was mutation-tested by reintroducing `Network hashrate` on Pools.

Two audits found nothing to change. Every use of "the Bitcoin" is correct English before a noun — the whitepaper, the network, the community — rather than the banned use for the asset. "modeled" appears once, deliberately, as a search alias so the American spelling finds the entry.

### What the walkthrough caught

Verifying the new surfaces in the browser at 1440 px and 390 px turned up three defects that the contracts alone would not have:

- **Chapters snapped shut under the reader.** `render()` rebuilds a tab from a template string, so every chapter a reader opened closed again on the next simulation tick — and on Method the clock is usually running. Which chapters are open is now transient view state that survives a repaint, with a contract to keep it that way.
- **"Terms and help" closed itself too.** The same repaint problem reached back into the Phase 4 disclosure on every operating tab: open it, wait one tick, and it shut. It now remembers per tab, so opening it on Mine does not open it on Pools.
- **A halving was labelled "Advance warning."** That label belongs to a risk that has not landed yet; a halving that has already cut the subsidy is a rules change, and the tense of the message contradicted the label. Added a `notice` feedback kind reading **Rules change**, which shares the amber warning treatment.
- **An 11 px touch target.** The "How this works in Method" link inside each glossary entry inherited a bare text-link style, against the Phase 4 rule of 34 px desktop and 40 px mobile. Both are now enforced by contract.

One copy error came from the formatter rather than the writing: a sentence arguing that satoshis are indivisible rendered 312,500,000 as "312.5M", because the shared number formatter compacts above a million. It now prints in full.

### Walkthrough, second pass

The remaining journeys were walked at 1440 px and 390 px: the transaction review, a blocked action and its touch helper, a historical event with a direct effect and one with context only, the monthly settlement with all three rescue routes, and the end-of-run recap. Every one renders its full copy structure, fits its viewport and introduces no horizontal overflow at either width. The event without a mechanic says so in as many words rather than falling through to a generic line.

Verification was at DOM level rather than by eye: the Browser pane was hidden for this session, so screenshots came back blank. Geometry, overflow and copy structure were measured directly instead.

The settlement leg found a real bug, and not an edge case. `queueMonthlySettlement` compared cash to the bill with `>=`, while `finishMonthlySettlement` allowed a 1e-8 float tolerance for the same comparison. Under the "Cover the bill" treasury policy the game sells exactly enough BTC to meet the bill, so cash lands on the due amount to within floating-point error — and about 8% of the time it lands a hair under. Those runs paused, demanded a rescue, and rendered the shortfall as "<$0.00000001 is needed before the operation can continue." Roughly one exactly-covered settlement in twelve. Both comparisons now use the same tolerance, with a contract to keep them in step.

### Still outstanding

- Copy contracts for required help patterns beyond the page-help map already covered.
- Two legs of the walkthrough matrix: the fault to self-repair-failure to successful-repair sequence, and receivership. Both were exercised from injected state rather than driven end to end, so their copy is contract-covered but not walked.
- Paragraph-level layering of guidance versus exact calculation inside the denser Method sections.

## Editorial review checklist

Use this checklist for every rewritten surface:

- Does the first sentence explain the player consequence?
- Is every specialist term defined before it is relied upon?
- Is the recommended action clear without opening Method?
- Does a blocked action include a recovery path?
- Are immediate cost, recurring cost and delay distinguished?
- Are cash, BTC and custodial claims kept conceptually separate?
- Is historical fact separated from derived or modelled behaviour?
- Can the primary copy be read comfortably on a phone?
- Is advanced detail still reachable?
- Does the copy use the canonical terminology in this document?

## Change discipline

- Rewrite one player journey or surface at a time.
- Preserve simulation behaviour unless a separate mechanic change is explicitly approved.
- Update UI-contract checks when copy is intentionally changed.
- Avoid exact full-paragraph assertions where a semantic contract can verify stable labels or attributes.
- Keep save compatibility when adding dismissed guidance or first-use help state.
- Run the project structure, UI-contract and historical-data checks after every implementation slice.
