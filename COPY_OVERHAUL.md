# Hashrate copy and help overhaul

Status: Phases 1–5 complete; Phase 6 reference and editorial QA is next.

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

- [ ] Split Method into navigable or collapsible chapters.
- [ ] Add an in-game glossary.
- [ ] Normalize terms, abbreviations, units, capitalization and recurring-cost notation.
- [ ] Add automated copy contracts for legacy terms and required help patterns.
- [ ] Complete desktop and mobile editorial walkthroughs.

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
