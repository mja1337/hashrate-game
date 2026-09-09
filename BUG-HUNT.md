# Bug hunt

A living list. Not a wishlist of features — a list of places this codebase has been shown to
go wrong, and the checks that would catch the next one of the same kind.

Every entry is a *class* of fault with real evidence behind it, because every one of these was
found the hard way at least once. Work top-down: the classes are ordered by how often they have
actually bitten.

**How to work an entry.** Reproduce it first — a fault you cannot reproduce is a guess. Then
fix, then write the contract that would have caught it, then *mutate*: reintroduce the bug and
confirm the contract fails. A contract that passes against the reintroduced bug is not a
contract, and this file records several that did exactly that.

Status: `open` · `hunting` · `swept` · `fixed` (with the commit) · `accepted` (known,
deliberately left).

**Everything found gets written down, fixed or not.** A hunt that finds three faults and fixes
one has still found three. Anything not fixed on the spot goes in *Open findings* below with
enough detail to act on cold — the reproduction, not just the symptom. The `Log` at the bottom
is the closed list; *Open findings* is the work.

---

## Open findings

Found, reproduced, not yet fixed. Newest first.

| # | Class | Finding | Reproduction | Severity |
|---|-------|---------|--------------|----------|
| F4 | 9 | ~42 boundary mutants remain across `fleet-ops`, `facilities`, `payouts`, `signing` — `>` vs `>=` on a due date, and similar. Spot-checked: these shift a job's completion by one simulated day and change nothing an operator could observe or act on. **Accepted, not unexamined**: writing a contract per boundary would pin arbitrary detail and make the suite hostile to ordinary edits. Revisit only if a due-date off-by-one ever produces a visible symptom. | `grep SURVIVORS /tmp/mut2.json` after re-running the sweep | Low |

---

## 1. Work parked behind an animation frame that never comes · **fixed** — F1 resolved

`requestAnimationFrame` does not fire in a hidden or backgrounded tab. Anything deferred behind
it alone stops happening, and comes back only if something else re-triggers it.

Bitten four times:
- The event modal that never drew while the clock sat stopped (`b308837`).
- The 3D floor that never mounted at all (`ad77732`).
- Verifying the stale repair row, where the paint never ran in the test pane.
- `queueRender()` itself — the last one, and the one that had been rated Low twice.

**F1 was underrated, and measuring it is what showed that.** The entry said "every known caller
has its own fallback" and rated it accepted. But the shared throttled path sat on `rAF` alone,
and because `renderQueued` stays true until a paint clears it, one parked frame silenced *every
later repaint* through the already-queued check. In a pane where `visibilityState` is
permanently `"hidden"`, the first paint after load was still pending eighteen seconds later,
with `lastRenderAt` at 0: the clock ran and the screen stopped, and only modal-urgent renders
got through. The fix races the frame against a timer — the frame wins when the page is being
looked at, the timer when it is not — with a schedule token so a stale fallback cannot paint
against a newer schedule and defeat the throttle that keeps 16x readable. Verified: 177
`queueRender` calls in 3.5s still produce 2 paints, and a hidden pane now follows the clock.

**The lesson is about the rating, not the bug.** "Every caller has its own fallback" was true
and irrelevant — the hazard was in the shared path they were all working around. Two callers
independently growing the same `setTimeout` workaround was the evidence, and I read it as
reassurance instead of as a symptom.

**Check:** grep for `requestAnimationFrame` and ask of each: what happens if this never fires?
If the answer is worse than "it draws late", it needs a timer armed alongside it.

## 2. Stale UI because the tick repainted with `refreshLive()` · **swept** (keep it swept)

The tick's ordinary repaint patches text only. Anything structural goes stale unless something
sets `renderFullQueued`, or it is in `bannerSignature()` / `modalSignature()`.

- Incident banner counting down to a date already passed → fixed by `bannerSignature()`.
- The modal that never appeared → `modalSignature()` (`b308837`).
- Repair rows frozen on "Reconnect · 0d left" while the job finished underneath (`976d6fd`+).

**Check:** drive each `advance*` function ON ITS OWN and watch `renderFullQueued`. Not through
`tick()` — faults raise the flag most days, so a tick-level probe reports every one of these as
fine while they are not. That masking is why this class survived so long.

Found by that method: cooling installs landing, pool payouts, the monthly second-hand listing
refresh, and the node reaching or falling off the chain tip — four surfaces drawn once and then
frozen.

**And the counter-rule, which matters as much.** Not every change wants a rebuild. Node sync
lag moves every single tick; asking for a full tab rebuild to animate a progress bar would undo
the entire reason the tick repaints with `refreshLive()`. A number that changes continuously
wants a text patch; a rebuild is for a change of STATE. Only the two transitions flag, and the
contract asserts that ordinary progress does *not* — a contract that only checked "did it ask"
would happily accept flagging everything.

Audited and asking: maintenance stages and completion, procurement, retirements, staged intake,
materials planning, cold spends, facility moves, fleet lifecycle, learning, cooling installs,
pool payouts, second-hand listings, node tip transitions.
Deliberately not asking: node sync progress, thermal temperature drift (both continuous).

## 3. A control offering what the action refuses · **swept** (keep it swept)

The card computes eligibility one way and the action another, and they drift.

Found in: immersion conversion, facility downsizing, cooling sales, hardware purchase limits,
the dead flat tech tab, and both service buttons — which checked three of the action's five
refusals and left Refurbish and Replace enabled with an empty tooltip on every OTHER machine
while you were on a bench yourself. Clicking did nothing at all.

**Check:** any `disabled={...}` whose condition is not literally the same function the action
calls. The fix is always the same — one `somethingBlockReason()` used by both, asserted as
PARITY rather than as a list of conditions, so a refusal added to the action and forgotten in
the helper fails the contract.

A refusal added to an action reaches its buttons only if somebody remembers. Adding the
cold-storage signing gate created exactly that gap, and there were TWO controls to fix — the
Custody tab's transfer and the threat lab's shortcut — so fixing the one the first grep turned
up left the other one broken. **When a control is duplicated, grep for the duplicate.**

**A button with no `disabled` at all is the fastest thing to grep for**, and three of the four
found that way were fine because the control is simply not *rendered* in the invalid state —
which is a legitimate answer. Only the fourth, immersion draining, was a real hit.

Audited and matching: service (`serviceBlockReason`), immersion convert and drain, downsize,
cooling sale and cancel, payout destination, cold spend (both controls), staged intake, skills
(`skillGateReason`), region relocation, custody policy, custody key assignment, energy
contract, node storage and mode, strategy, learning, pool selection.

Class 3 is now swept. What remains is keeping it swept: **every new refusal added to an action
needs its buttons revisited**, and the two bugs found here were both refusals added later than
the control they should have disabled.

## 4. A boolean where a count was meant · **fixed** `8c13c5f`

`hasStaff(id)` answers *whether*, never *how many*. Hiring 25 field technicians did nothing
past the first for commissioning and retirement, and past the third for repairs (`8c13c5f`).

**Check:** every `hasStaff(` call site. Does the thing it gates scale with headcount in
reality? Same question for any other predicate standing in for a quantity.

Audited: all twelve call sites. `hireStaff()` refuses a duplicate for every role except
`fieldtech`, so `hasStaff` is the right question for the eleven singleton posts and was the
wrong one for all three field-technician sites. Re-run this audit if any other role becomes
multi-hire.

## 5. Capacity reserved by the wrong set · **fixed** `8ce707e`

Headroom measured against installed machines only, so in-flight commissioning reserved nothing
and the daily intake started a fresh job every day for the length of the last one. A player lost
months of a 575,000-machine farm to it.

**Check:** any "how much room is left" calculation — enumerate what is in flight and decide
deliberately whether each reserves. Orders and staged crates should not; work in progress must.

## 6. A stoppage the game cannot explain · **fixed** `8ce707e`

`operating()` was a single boolean and one term could go false silently. Now `siteStopReason()`.

**Check:** any boolean gating the whole simulation. If it can be false, something must be able
to say why in a sentence a player can act on.

## 7. Rebuild churn from an over-broad signature · **fixed** `ad77732`

The 3D floor keyed its rebuild on every batch's *status*, so a fleet with churning faults
rebuilt the whole scene every tick and eventually lost the WebGL context.

**Check:** every cache/rebuild signature — does each term change the *structure*, or only the
paint? Paint belongs in a cheaper path.

## 8. Contracts that assert the bug · **hunting**

The intake rule expected all 60 bought machines to end up racked in a workshop that can power
29. It passed because the code really was over-committing.

**Check:** any contract asserting a specific outcome number rather than an invariant. Ask what
the number *should* be from first principles, not from what the code currently does.

## 9. Vacuous or under-powered contracts · **hunting**

Several have passed their mutants first time by being too loose:
- Counting cross-branch skill edges (survives deleting any one) → named them instead.
- Asserting a depth function is *called* (survives every node drawn on row zero) → pinned the row.
- Asserting two values are equal without asserting *what* (survives both collapsing to 1).
- Proving `crossPattern()` correct while the caller handed out a hardcoded order.
- Driving an advance helper by hand, which survives deleting its call from `tick()`.
- A refusal path unreachable from the tested route (order deeper than the listing).

**Check:** mutate every new contract. If it survives, the contract is the bug.

## 10. Cross-rule contamination in the behavioural harness · **fixed** (this pass)

`SITE()` now resets facility, region, seen events, hardware alerts, secondary stock, pool
account, and the cumulative `mined`/`blocks` counters — each added after a rule failed for
reasons that had nothing to do with it.

The fleet lifecycle — `commissioningJobs`, `procurementOrders`, `retirementJobs`,
`inactiveHardware`, `poweredDownHardware`, `decommissionedHardware`, `stagedCondition` — was
added late and `SITE()` never learned it. Rules cleared those by hand, so the reset was only as
good as the author's memory. Found by mutation, not by the suite: a mutant in
`facilityDownsizeBlockReason` killed the downsize rule *and* an unrelated repair-stage rule,
because the stranded site left a commissioning job running that went on landing machines into
the next rule's floor.

**The general lesson.** A green suite does not prove isolation, because contamination only
shows when a rule starts failing — and a passing rule that depends on its predecessor is
already broken, it just has not been asked yet. Mutation testing finds it: a mutant should kill
*exactly* the rules that cover the mutated code. Extra casualties are contamination, and they
are worth chasing even though the suite is green.

**Check:** when a rule fails that you did not touch, suspect the rule *above* it before the
code. When a mutant kills more rules than it should, the harness is leaking.

## 14. A suite that runs against a different world each time · **fixed** (this pass)

`initialState()` seeds the engine's random stream from `Math.random()`, and `SITE()` did not
override it — so all 119 rules ran against a different world on every invocation, sharing one
advancing stream. Only one rule seeded deliberately. The racking rule failed once with three
machines "missing" and then passed six runs in a row, which is the worst way a suite can
behave: it teaches you to re-run rather than to look. `SITE()` now fixes the seed, and a rule
wanting a different draw overrides it visibly.

**Check:** run the suite six times and count failures. Anything other than an identical count
every time means a rule is reading a random world.

## 18. One question, six spellings · **fixed** (this pass)

F4's surviving mutants were overwhelmingly one thing: the boundary on a due date, unasserted.
I accepted them on the grounds that a one-day shift changes nothing observable, and that each
would need its own contract. The second half was wrong, and it made the first half look
reasonable.

The question was written six ways — `job.due>t`, `t<job.due`, `t>=job.due`, `job.due<=t`, and
two of those with the operands swapped. Each spelling was a separate chance to invert the
boundary, and none had anywhere to be asserted because nothing owned the question. `dueBy()`
and `pendingAt()` in `config/timeline.js` own it now; fourteen call sites read them, and the
boundary is asserted once in the rule that owns it.

**Two things worth keeping from this.** The contract found a bug in the helper on its first
run: `Number(null)` is `0` and `Number("")` is `0`, so the obvious one-liner read a null due
date as "due since 1970". And the pair are deliberately *not* complements for a missing date —
both false — because that is what the hand-written comparisons did in both directions.

**Check:** a class of survivors that "would each need its own contract" is usually a class
that needs one shared definition instead. Count the spellings before writing the contracts.

**And the "harmless one-day shift" reading was wrong.** With the due-date survivors gone, what
remained was not more of the same. Four were plainly observable and are now contracted:

- `owned<1` → `<=1`, twice: the only machine you own becomes untouchable — cannot be stopped,
  cannot be retired, no message saying why. The whole early game is one machine.
- `threshold>1` → `>=1`, twice: a single-key wallet pays the 1.35x quorum fee on every payout
  and is told its coins were released by "signatures gathered from keys held apart" — a charge
  for protection it does not have, in the part of the game built to teach the difference.
- `fs.hash<=0` → `<0`: a site at exactly zero hash falls through every branch of
  `siteStopReason` and returns nothing — the original 575k-machine bug, restored inside the
  function written to prevent it.

One is genuinely equivalent and now recorded as such rather than left ambiguous:
`stagedFitCount>=staged` → `>` cannot be observed, because when the crates fit exactly both
shortfalls compute to zero, `parts` is empty and the function returns `""` down either path.
A later guard covers the boundary. That is an equivalent mutant, not a missing contract, and
the difference is worth writing down once you have checked which it is.

## 19. A mutation harness that mutated its own comments · **fixed** (this pass)

The sweep skipped lines *starting* with a comment marker, so every continuation line inside a
block comment was fair game. It reported six survivors in `config/timeline.js` that were all
prose — inside the comment explaining the very operator being mutated — each costing a full
suite run to discover it had changed nothing. Strings are the same trap: flipping a `>` inside
`<h3>` yields different HTML, no failure, and a survivor that means nothing. Five of the other
survivors were exactly that.

`scripts/mutate-engine.mjs` now lexes the file into code, comment and string regions and
mutates only code — while still treating a template literal's `${...}` as code, because that
is where a label-picking ternary lives. On `timeline.js`: 2 real mutants, 0 survivors, 2,306
comment and string positions skipped. The old sweep claimed 6 survivors there.

It also lives in the repo now instead of `/tmp`, so the check below is reproducible.

**Check:** `node scripts/mutate-engine.mjs [file ...]` — every survivor is either a missing
contract or an equivalent mutant. Decide which, in writing, one at a time.

## 17. A new module has three homes · **fixed** (this pass)

Extracting `render-queue.js` needed it added to `index.html`, the `expectedScripts` manifest in
`check-project-structure`, **and** the file list in `engine-harness`. Missing the third broke 12
engine rules with `queueRender is not defined`, and missing the second broke the structure
suite. Both failed loudly, which is the good case — but they failed one at a time, after the
fact, and nothing states up front that the three lists must agree.

Note also that the structure suite *passed* a deliberately wrong load order, because the
manifest and `index.html` were edited consistently. Agreement between the two lists is not the
same as the order being right, which is why the load-order assertion lives in the UI contracts
and names the reason.

**Check:** after adding a module, run all five suites, not the one you were working in.

## 16. A gate that could be outrun · **fixed** (this pass)

The behavioural suite collected failures into an array and reported them near the end of the
file. Three rules appended below that point ran, failed, pushed onto the array, and were never
printed — the suite said "121 rules exercised" and exited zero while one of them was failing on
every run. A mutant survived purely because of *where* its contract happened to be written.

The gate now runs from `process.on("exit")`, which no later rule can outrun, and sets
`process.exitCode` rather than calling `process.exit()` so the hook completes.

**Check:** apply a mutant you know a contract covers. If the suite still exits zero, the gate is
not seeing that contract — look at position before doubting the contract.

## 15. An assertion that matched the wrong file · **fixed** (this pass)

`check-ui-contracts` concatenates every application script into one `inline` string, which is
right for "does this call exist anywhere" and wrong for "does *this file* do this". A new
assertion pinned the glossary DOM filter's query normalisation and passed against a mutant,
because `glossary.js` contains the identical line and satisfied the match. Per-file sources
already exist (`renderSource`, `glossarySource`); the assertion now uses one.

**Check:** any assertion about how a *particular* file behaves must match that file's own
source. If the same line legitimately appears in two files, matching `inline` proves nothing.

## 12. A guard that exists but was never wired in · **swept** — F3 resolved

`retiringCount()` was written to answer "how many of these are already on their way out", and
nothing ever called it — so the retirement action caps on machines *owned* and lets the same
fleet be booked twice. The function existing is what makes this hard to see: the concept was
modelled, so a reader assumes it is enforced.

Eight more unreferenced functions sit alongside it (see F3). Those turned out to be duplicates
of guards enforced elsewhere, which is the more dangerous half of this class: they are not
bugs today, they are the reason someone removes the real guard tomorrow believing this one
covers it.

**Check:** list every `function` declaration whose name appears exactly once across `src/` and
`index.html`. For each, find what *does* enforce that rule. If nothing does, that is the bug.
Count *code* references only — a mention inside a comment satisfied the naive grep and hid
`pendingCoolingOrdersFor` for a whole pass.

**All nine resolved, and the split is the interesting part.** Two were real missing guards and
are now wired in (`retiringCount`, `pendingCoolingOrdersFor`). Six were deleted as genuine
duplicates of a guard enforced elsewhere. One was kept: `glossaryEntries` is the testable
specification of glossary search, and the shipped DOM filter is a second implementation of the
same rule that shares `glossarySearchKey` with it.

**The one that nearly caused a bug is the lesson.** `activePoolShare()` looked like an obvious
DRY win — `poolExplorerBody` contains that exact expression inline. But the helper hardcodes
`state.time` while the caller takes `t` as a parameter, and `updatePoolExplorer` drives it with
a historical scrubber clamped to `[START, now]`. Adopting the helper would have pinned the pool
explorer to today, silently breaking every past date on the slider. **An extracted helper can
be less general than the code it appears to duplicate**, so a wire-in is a behaviour change to
be tested, never a tidy-up to be applied on sight.

## 13. Invariants nobody thought to assert · **swept** — now automated

`scripts/fuzz-engine.mjs` drives the engine with random operator actions for 12 seeds × 4000
days and insists only that the world stay describable: no throw, no non-finite number, no
negative fleet or wallet, and no site carrying more than it can hold with overdrive off.

That last one is the whole value. Over capacity is *not* automatically wrong — overdrive
deliberately pushes draw past the cap, and that is the operator's call — so the invariant had
to be written around the one case where no such decision exists. Written that way it found the
racking-during-a-move stranding on seed 4, which no rule in the suite was asking about, and
which the behavioural suite passed straight through.

**Tuning it took two goes, and the first was wrong in an instructive way.** The check began as
"over capacity with overdrive off for more than three days", which fired on seed 4 — a fleet
sitting over its cap for four days because cooling demand rose with the heat, explained plainly
by `siteStopReason()`, and recovered on its own. That is the simulation working, not a bug. The
fix was not to raise the threshold until it went quiet: that trades away the sensitivity the
check exists for. Power and floor space fail differently, so they are now asked about
separately — power is a load that legitimately spikes and recovers, so only a breach that never
ends counts; floor space is not a load, racks do not grow when it is warm, so more machines on
the floor than the floor holds is always wrong and needs no patience at all.

**A fuzzer only finds what it can reach, and proving that takes a mutant too.** Reintroducing
the racking-during-a-move stranding and running 60 seeds caught it *zero* times. The
precondition is crates standing in `inactiveHardware` when a move is dispatched, and crates
only accumulate when intake is capacity-blocked — which ordinary random buying almost never
achieves. An action that deliberately overshoots capacity (50-450 units) was added, and the
same mutant is now caught on seed 6. The lesson generalises: after writing an invariant, break
the code it guards and confirm the fuzzer notices. An unreachable state is an unasserted one.

That run also exposed a check that could not fire at all: `STRANDED_DAYS` was declared in the
module but used inside the string evaluated in the VM, so the power branch threw instead of
testing, and the surrounding grep reported "not caught" rather than "errored". Two failures
that look identical from outside — silence — and only one of them is real.

**Check:** `node scripts/fuzz-engine.mjs` — a failure prints the seed, and
`node scripts/fuzz-engine.mjs <seed>` replays exactly that run.

**And the harness had this bug first.** The engine keeps its own random stream — faults,
events, weather, market noise — which `initialState()` seeds from `Math.random()`. The fuzzer
seeded only its action chooser, so a run was half-reproducible: the same actions every time,
a different world each time. A failure found on seed 29 passed on replay, which is worse than
having no replay at all, because it reads as a flake and gets dismissed. Both streams are
seeded now. Any harness that advertises reproducibility should be made to prove it — run the
same seed three times and compare `state.rng`, not just the pass/fail.

## 11. Module-ceiling extractions done in a hurry · **hunting**

The 70KB ceiling forces splits mid-task, and a careless slice moved the whole fleet lifecycle
into `thermal.js` because it sat between two cooling functions.

**Check:** after any extraction, read what actually moved. `grep -n "^function"` the destination
and ask whether every name belongs there.

---

## Log

| Date | Class | Finding | Commit |
|---|---|---|---|
| 2026-09-09 | 18 | F4 resolved at the cause: the due-date boundary was written six ways and owned by nothing. `dueBy`/`pendingAt` now own it, 14 call sites migrated, one contract pins the boundary, a guard stops the spellings returning. The contract caught a null-coercion bug in the helper on its first run | `81b8ceb` |
| 2026-09-09 | 11 | `method-chapters.js` had 316 bytes of headroom — the real ceiling breach, not `simulation.js`. Fleet chapter extracted as the seam that grows | `b9e59a1` |
| 2026-09-09 | 1 | F1: `queueRender`'s throttled paint sat on rAF alone, so a hidden tab never repainted and `renderQueued` stayed true, dropping every later repaint. Measured: first paint after load still pending 18s later in a permanently-hidden pane. Frame and timer now race, tokenised so the throttle holds | `ceb1089` |
| 2026-09-09 | 17 | Adding one module required three separate lists to agree; two failed after the fact | `ceb1089` |
| 2026-09-09 | 11 | `simulation.js` breached the 70KB ceiling. Extracted `render-queue.js` as a real seam — the clock and when its effects reach the glass — rather than trimming comments to fit | `ceb1089` |
| 2026-09-09 | 16 | The behavioural suite's failure gate sat two lines above the end of the file, so three rules appended after it ran, failed, and were never reported — the suite announced 121 passing while one failed every run. Moved to an exit hook | `f70f5df` |
| 2026-09-09 | 10 | `SITE()` never reset `wallets`, `hardware`, `activity` or `log`. Rules set the first two by *replacing* the object, dropping every key they did not name — one rule deleted `mtgox`, `bitfinex`, `quadriga`, `frontier` and `etf` for every rule after it | `f70f5df` |
| 2026-09-09 | 9 | F4: eight surviving clamp mutants killed. The worst was `stageDelivery`'s staged count — inverting it destroys crates already waiting rather than mis-averaging them | `f70f5df` |
| 2026-09-09 | 14 | All 119 behavioural rules ran against a `Math.random()`-seeded world; the racking rule failed once then passed six times | `d591d08` |
| 2026-09-09 | 12 | F3 resolved: 2 of 9 never-called functions were real missing guards, 6 deleted as duplicates, 1 kept as the tested spec. `activePoolShare` would have broken the pool explorer's history slider if wired in | `d591d08` |
| 2026-09-09 | 9 | A new glossary assertion matched the *same line in another file* — `glossary.js` and `render.js` both normalise the query identically, so testing the concatenated source passed whatever `render.js` did. Scoped to `renderSource` | `d591d08` |
| 2026-09-09 | 8 | Two contracts asserted spares the game never consults (`skillPrereqsMet`, `coldSpendPending`) — repointed at the shipped paths | `d591d08` |
| 2026-09-09 | 9 | Nothing asserted the shape of facility move risk: turning the `.48` ceiling into a floor made every expansion at least a coin-flip and the suite passed. Same for the `Math.min(state.cash,…)` clamp on incident fees — inverted, it drove cash to -73,471 from a balance of 500 | `c49c227` |
| 2026-09-09 | 5 | Cooling on order was invisible to the move gate — plant ordered in a large site installs into whichever site you are standing in when the fitters finish. Third instance of the same in-flight-work class; `pendingCoolingOrdersFor()` was written for it and never called | `c49c227` |
| 2026-09-09 | 13 | The fuzz power invariant threw instead of checking — a module constant referenced inside the VM-evaluated string — and 60 seeds could not reach the stranding precondition at all until an overshooting order action was added | `c49c227` |
| 2026-09-09 | 13 | The fuzzer's replay was a lie: `initialState()` seeds the engine's own random stream from `Math.random()`, so a seed fixed the actions but not the world. A failure found on one run passed on replay | `c49c227` |
| 2026-09-08 | 5 | Crates on the floor were racked against the site being *left* during a move, landing 306 machines and 999 kW into a 100 kW workshop — stranded for good. Found by the new fuzzer, not by a rule | `915fa67` |
| 2026-09-08 | 12 | Retirement booked against machines owned rather than machines still racked; `retiringCount()` existed for this and was never called | `915fa67` |
| 2026-09-08 | — | 12 fuzz seeds × 4000 days of random operator actions, and a 17-year idle run: no throw, no non-finite state, no negative fleet or wallet. Clean. | *audit* |
| 2026-09-08 | 5 | Downsize judged fit on the installed fleet, ignoring machines mid-commission — the crates land anyway and strand the site | `e45b365` |
| 2026-09-08 | 10 | `SITE()` never reset the fleet-lifecycle state, so a stalled commissioning job leaked into later rules | `e45b365` |
| 2026-09-08 | — | Save migration audited against a pre-session save: 120 ticks, no missing fields, no non-finite numbers, legacy job drained, `floorView` migrated. Clean. | *audit* |
| 2026-09-08 | 2 | Cooling installs, pool payouts, listing refreshes and node tip changes drawn once then frozen | `569e496` |
| 2026-09-08 | 3 | Immersion drain offered with no cash for the refit labour | `333190f` |
| 2026-09-08 | 3 | Both cold→hot controls enabled on a wallet that cannot sign | `020f3b5` |
| 2026-09-08 | 3 | Service buttons enabled while you were already on a bench; clicking did nothing | `c02ee69` |
| 2026-09-08 | 2 | Repair rows froze on "Reconnect · 0d left" while the job finished | `bc69119` |
| 2026-09-08 | 4 | Field technicians did not stack — boolean, not count | `8c13c5f` |
| 2026-09-08 | 7 | 3D floor rebuilt every tick, lost the WebGL context at ~50k miners | `ad77732` |
| 2026-09-08 | 5, 6 | Site held more fleet than it could carry, and said nothing | `8ce707e` |
| 2026-09-08 | 1, 2 | Major-event modal never drew on the Mine tab | `b308837` |
