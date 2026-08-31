# Hashrate — Steam store listing (draft)

---

## Name

**Hashrate**

## Short description
*(Steam limit: 300 characters — this is 238)*

> Start with one laptop in 2009. Run a Bitcoin mining operation through the entire real history of the network — every price, every difficulty retarget, every collapse — and try to still be solvent in 2026. Then keep going for a hundred more years.

## Tags

`Simulation` · `Management` · `Economy` · `Singleplayer` · `Historical` · `Resource Management` · `Base Building` · `Strategy` · `Realistic` · `Offline`

---

## About this game

It is February 2009. You have one laptop, a wallet you generated yourself, and no idea what any of this will be worth.

**Hashrate** is a management simulation that runs on the real history of Bitcoin mining. Not a dramatisation of it — the actual recorded data. Every day of price since the first quoted trade. Every difficulty retarget the protocol has ever performed, at the exact block it happened. The real hash rate, the real fee market, the real block height. When Mt. Gox fails, it fails on the day it failed, and if your coins are on it, they are gone.

Your job is to still be here at the end.

### Mining is the easy part

Machines earn BTC. Bills are due in cash. Those are two different balances, and the gap between them is where runs die.

Every month the operating bill arrives — electricity, rent, internet, payroll, insurance, finance interest — and it does not care that your BTC has tripled. You can sell into it, liquidate hardware, take bridge finance at a penalty, miss the bill entirely and run on borrowed time, or hand the business to a receiver and keep going with less. Miss it and the grid gives you until the next bill date. Miss that one and the power goes off while the costs keep accruing.

### An operation that behaves like one

- **18 machines** across seventeen years, from a basic laptop through GPU rigs and FPGAs to the Antminer S21 XP. Each arrives when it actually shipped, and is obsolete when it actually was.
- **8 sites**, from a spare room on one circuit to a 180 MW sovereign megacampus. Every site has two separate limits — electrical capacity and floor space — and you can run out of either while the other has room.
- **8 regions** with real climates, real tariffs and real political risk: central Washington, Reykjavík, Chengdu, Ekibastuz, west Texas, the Iranian plateau, the Nairobi highlands, Thimphu.
- **Heat that obeys physics.** A room sheds heat in proportion to how much hotter it is than outside. One kilowatt-class ASIC in a spare room is fine through a Washington winter and a genuine problem in July. Cooling is a dial, not a switch, and it takes weeks to install.
- **Hardware that wears out.** Condition decays, components fail, and you fix them yourself at the bench — pulling the old part, matching cable pairs, torquing to spec — until you can afford technicians. Over-torque it and you damage the machine.

### History that happens to you

**62 dated chapters** from the Genesis Block to 2026: exchange collapses, the halvings, China's mining ban, the fee-market shocks, the regulatory turns. Each one separates what happened, why it mattered, and what it does to *your* operation — and says so plainly when the answer is "nothing directly."

**15 mining pools** running the payout schemes they actually ran, when they actually ran them. Proportional gives way to score, then PPLNS, then PPS, then FPPS once fees were worth passing on. A pool will never be shown running a scheme before it was invented.

**Custody that can lose you money.** Hot wallets, cold storage, exchange balances, frozen claims, full nodes, Lightning channels. Where your coins sit when a venue fails is the difference between a bad month and a finished run.

### Then the history runs out

The recorded feed ends, and you choose whether to stop. Continue and the simulation runs a further **hundred years** on projections built from the history you just played: the halving cycle measured from the real epochs, volatility calibrated to the real series, twenty-five more halvings, all the way down to a nine-satoshi block subsidy. No new events are invented and no new hardware appears, because none exists. Everything after the cutoff is labelled as modelled, never as history.

### Honest about what it knows

Every number in the game is one of three things, and the game tells you which: **recorded** from the bundled dataset, **derived** from those recordings, or **modelled** as a gameplay assumption. The manual shows the formulas, the sources and the assumptions — including where the early years are deliberately damped, and by exactly how much.

---

## Feature list *(short bullets for the store sidebar)*

- Seventeen years of real recorded Bitcoin data — price, hash rate, difficulty, fees, block height
- 18 miners, 8 sites, 8 regions, 15 pools, 62 historical chapters
- Four starting eras from the Genesis Block to 2025, from generous to near-impossible
- A 1,000-point Operator Score built from solvency, profitability, uptime and custody
- 100 further simulated years of procedural continuation after the history ends
- A full operator's manual, a searchable 53-term glossary, and contextual help on every screen
- Plays entirely offline. No account, no telemetry, no network calls.

---

## System requirements

**Minimum**
- **OS:** Windows 10, macOS 11, or a modern Linux distribution
- **Processor:** Any 64-bit dual-core
- **Memory:** 2 GB RAM
- **Graphics:** Integrated
- **Storage:** 50 MB
- **Additional:** No internet connection required after installation

---

## Before this can go live

Flagging these rather than writing around them — the listing above describes the game accurately, but a Steam release needs things that do not exist yet:

1. **A desktop build.** The game is currently a browser application. Steam needs a packaged executable — an Electron or Tauri wrapper is the usual route and would not require touching the game code.
2. **Screenshots and a capsule image.** Steam requires a 616×353 header, a 374×448 vertical capsule, and at least five screenshots. The mining floor, the thermal console, a settlement decision, a historical event and the Method manual are the five that show what the game is.
3. **A trailer.** Steam strongly favours listings with one.
4. **Pricing, age rating and a release date.**
5. **A decision on the name.** "Hashrate" is likely to be crowded on Steam search; something like *Hashrate: Genesis to Now* — already the browser title — would be easier to find.
