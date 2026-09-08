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

Status: `open` · `hunting` · `fixed` (with the commit) · `accepted` (known, deliberately left).

---

## 1. Work parked behind an animation frame that never comes · **open**

`requestAnimationFrame` does not fire in a hidden or backgrounded tab. Anything deferred behind
it alone stops happening, and comes back only if something else re-triggers it.

Bitten three times:
- The event modal that never drew while the clock sat stopped (`b308837`).
- The 3D floor that never mounted at all (`ad77732`).
- Verifying the stale repair row, where the paint never ran in the test pane.

`queueRender()` still parks non-urgent repaints behind `setTimeout` → `rAF`. On a hidden tab
that means no repaint at all until the tab is looked at again, which currently recovers via the
visibility handler — hence `accepted` rather than fixed, but it is the reason the test pane
cannot verify any repaint and every such fix has to be argued rather than demonstrated.

**Check:** grep for `requestAnimationFrame` and ask of each: what happens if this never fires?
If the answer is worse than "it draws late", it needs a timer armed alongside it.

## 2. Stale UI because the tick repainted with `refreshLive()` · **hunting**

The tick's ordinary repaint patches text only. Anything structural goes stale unless something
sets `renderFullQueued`, or it is in `bannerSignature()` / `modalSignature()`.

- Incident banner counting down to a date already passed → fixed by `bannerSignature()`.
- The modal that never appeared → `modalSignature()` (`b308837`).
- Repair rows frozen on "Reconnect · 0d left" while the job finished underneath (`976d6fd`+).

**Check:** for each thing the tick can change, ask which repaint draws it. If the answer is
"a full render", something has to ask for one. Candidates not yet audited: procurement rows,
cooling install progress, pool payout accrual, staged-intake changes, career/XP surfaces.

## 3. A control offering what the action refuses · **hunting**

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

Audited and matching: service (`serviceBlockReason`), immersion, downsize, cooling sale, payout
destination, cold spend (both controls), staged intake, skills (`skillGateReason`), region
relocation (`available` covers the Sichuan closure).
Not yet audited: energy contracts, node storage and mode, venue deposits and withdrawals,
strategy securities, learning items, pool selection.

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

## 10. Cross-rule contamination in the behavioural harness · **hunting**

`SITE()` now resets facility, region, seen events, hardware alerts, secondary stock, pool
account, and the cumulative `mined`/`blocks` counters — each added after a rule failed for
reasons that had nothing to do with it.

**Check:** when a rule fails that you did not touch, suspect the rule *above* it before the code.

## 11. Module-ceiling extractions done in a hurry · **hunting**

The 70KB ceiling forces splits mid-task, and a careless slice moved the whole fleet lifecycle
into `thermal.js` because it sat between two cooling functions.

**Check:** after any extraction, read what actually moved. `grep -n "^function"` the destination
and ask whether every name belongs there.

---

## Log

| Date | Class | Finding | Commit |
|---|---|---|---|
| 2026-09-08 | 3 | Both cold→hot controls enabled on a wallet that cannot sign | `020f3b5` |
| 2026-09-08 | 3 | Service buttons enabled while you were already on a bench; clicking did nothing | `c02ee69` |
| 2026-09-08 | 2 | Repair rows froze on "Reconnect · 0d left" while the job finished | `bc69119` |
| 2026-09-08 | 4 | Field technicians did not stack — boolean, not count | `8c13c5f` |
| 2026-09-08 | 7 | 3D floor rebuilt every tick, lost the WebGL context at ~50k miners | `ad77732` |
| 2026-09-08 | 5, 6 | Site held more fleet than it could carry, and said nothing | `8ce707e` |
| 2026-09-08 | 1, 2 | Major-event modal never drew on the Mine tab | `b308837` |
