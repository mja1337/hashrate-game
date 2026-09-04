import { readFile, readdir } from "node:fs/promises";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const html = await readFile(new URL("index.html", root), "utf8");
const css = await readFile(new URL("src/styles/app.css", root), "utf8");
const appScripts = [...html.matchAll(/<script src="(src\/[^"]+\.js)"><\/script>/g)].map(match => match[1]);
const inline = (await Promise.all(appScripts.map(file => readFile(new URL(file, root), "utf8")))).join("\n");
const simulationSource = await readFile(new URL("src/engine/simulation.js", root), "utf8");
const buildSource = await readFile(new URL("scripts/build-historical-data.mjs", root), "utf8");
const renderSource = await readFile(new URL("src/ui/render.js", root), "utf8");
const operatorSource = await readFile(new URL("src/engine/operator.js", root), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const modeStart = inline.indexOf("const STARTING_MODES=[");
const modeEnd = inline.indexOf("\n];", modeStart) + 3;
assert(modeStart >= 0 && modeEnd > modeStart, "STARTING_MODES could not be extracted");
const modeContext = {};
const timelineSource = await readFile(new URL("src/config/timeline.js", root), "utf8");
vm.runInNewContext(timelineSource, modeContext);
vm.runInNewContext(inline.slice(modeStart, modeEnd).replace("const STARTING_MODES", "var STARTING_MODES"), modeContext);
assert(JSON.stringify(modeContext.STARTING_MODES.map(({ id, start }) => [id, start])) === JSON.stringify([
  ["easy", 1230940800000],
  ["medium", 1233619200000],
  ["hard", 1359417600000],
  ["impossible", 1735689600000],
]), "Campaign start-date options changed unexpectedly");

const helperNames = ["fmtUsd", "fmtBtc", "fmtCompactNumber", "fmtCompactUsd"];
const helperSource = inline.split(/\r?\n/).filter(line => helperNames.some(name => line.startsWith(`function ${name}(`))).join("\n");
const helperContext = { Intl, Number, Math };
vm.runInNewContext(helperSource, helperContext);
assert(helperContext.fmtUsd(Number.NaN) === "—", "Invalid USD values must not be displayed as zero");
assert(helperContext.fmtUsd(0.0004) === "$0.0004", "Tiny USD values lost precision");
assert(helperContext.fmtBtc(0.000000001) === "<0.00000001 BTC", "Sub-satoshi BTC values must not be displayed as zero");
assert(helperContext.fmtCompactUsd(0.004) !== "$0", "Compact USD formatting rounded a non-zero value to zero");

assert(inline.includes("STARTING_LIQUIDITY_MIN=1500") && inline.includes("STARTING_LIQUIDITY_MAX=1500000"), "Starting Liquidity limits are missing or incorrect");
assert(inline.includes("data-starting-cash") && inline.includes("Starting Liquidity"), "Starting Liquidity controls are missing");
assert(inline.includes("state.cash=liquidity;state.startingCash=liquidity"), "The selected Starting Liquidity is not applied when a run begins");
const introStart = inline.indexOf("const INTRO_SLIDES=[");
const introEnd = inline.indexOf("\n];", introStart) + 3;
const introContext = {};
vm.runInNewContext(inline.slice(introStart, introEnd).replace("const INTRO_SLIDES", "var INTRO_SLIDES"), introContext);
assert(introContext.INTRO_SLIDES.length === 3, "The first-run introduction must remain a focused three-beat journey");
assert(introContext.INTRO_SLIDES[0].title.includes("mining operation") && introContext.INTRO_SLIDES[1].title.includes("Keep adapting") && introContext.INTRO_SLIDES[2].title.includes("starting era"), "The introduction no longer teaches role, operating loop and run setup in order");
assert(inline.includes("guidance:{dismissed:[]}") && inline.includes("state.guidance=Object.assign({dismissed:[]}") && inline.includes('if(a==="dismiss-guidance")'), "Save-compatible Operator briefing dismissals are missing");
assert(inline.includes("function operatorBriefing()") && inline.includes("Operator briefing ·") && inline.includes("Recommended next step") && inline.includes("New to Bitcoin mining? Start with these terms"), "The state-aware newcomer Operator briefing is incomplete");
assert(inline.includes('if(state.pendingSettlement)return""') && inline.includes('id:"grid-arrears"') && inline.includes('id:"high-temperature"') && inline.includes('id:"open-faults"') && inline.includes('id:"capacity-pressure"') && inline.includes('id:"first-run"') && inline.includes('id:"first-bill"') && inline.includes('id:"first-upgrade"') && inline.includes('id:"pool-available"') && inline.includes('id:"low-runway"'), "Operator briefing priority states are incomplete");
assert(inline.includes("A Bitcoin wallet manages private keys") && inline.includes("Do not use this key for real bitcoin"), "Wallet setup is missing its newcomer purpose or safety explanation");
assert(inline.includes('data-action="starting-mode"'), "Difficulty controls are missing");
assert(inline.includes("Starting difficulty"), "Method is missing difficulty documentation");
assert(inline.includes("Transaction sizing and procurement"), "Method is missing transaction documentation");
assert(inline.includes('if(a==="starting-mode")'), "Difficulty action is not handled");
assert(inline.includes("transactionPreviewValid(preview)"), "Invalid transaction quotes are not blocked");
assert(inline.includes("function enhanceActiveTab()") && inline.includes("const enhancer=TAB_ENHANCERS[activeTab];"), "Tab enhancement must be dispatched from one place that always runs");
assert(/document\.getElementById\("app"\)\.innerHTML=`[\s\S]*?\n  enhanceActiveTab\(\);/.test(renderSource), "The enhancer has to run in the same task as the markup it completes: deferring it to a timeout meant any repaint landing in the gap cancelled it, and nothing retried");
assert(!inline.includes("function deferEnhancement("), "The deferred-enhancement helper is what left the Mine tab half-built; it should not come back");
assert(!/deferEnhancement\(revision/.test(inline), "A tab enhancer is being deferred again");
assert(inline.includes('class="card span-12 exchange-balance-desk"'), "Market exchange-balance summary is missing");
assert(inline.includes('class="span-12 facility-grid facility-options"'), "Facilities choices do not have a stable ordering target");
assert(inline.includes('if(command&&facilityOptions)command.insertAdjacentElement("afterend",facilityOptions)'), "Facility choices are not placed directly below the current-facility command");
assert(inline.includes("Math.min(900,Math.max(240,Math.ceil(days/7)+1))"), "Historical charts are not using capped weekly-or-better sampling");
assert(inline.includes('"dashboard","mine","pools","market"'), "Pools is not a standalone navigation destination");
assert(inline.includes('if(activeTab==="pools")return pools()'), "Pools page is not routed");
assert(inline.includes('id:"bch"') && inline.includes('id:"bsv"'), "BCH and BSV fork-risk actions are missing");
assert(inline.includes("Your operation · Bitcoin's history") && inline.includes("The operating loop") && inline.includes("Choose your run"), "The three-beat newcomer introduction is incomplete");
assert(inline.includes('class="mobile-pause-button') && inline.includes('class="mobile-speed-panel"'), "Mobile simulation controls are missing");
assert(inline.includes('data-action="mobile-menu-section"') && inline.includes('mobileMenuSection="play"'), "Mobile navigation is not grouped into first-tap sections");
assert(css.includes('.mobile-menu-sections{display:grid;grid-template-columns:repeat(4') && css.includes('.mobile-nav-tabs{display:grid;grid-template-columns:repeat(4'), "Mobile secondary navigation is not condensed for small screens");
assert(css.includes("#dashboard-mempool{overflow:hidden}") && css.includes(".mp-chain{width:100%;flex:0 0 auto"), "Mobile mempool containment rules are missing");
assert(inline.includes('const tickerBtc=value=>fmtBtc(value).replace(/ BTC$/,'), "Ticker BTC values still include a redundant unit suffix");
assert(css.includes(".tick{min-width:115px;overflow:hidden") && css.includes("text-overflow:ellipsis"), "Ticker values can spill into adjacent cards");
assert(inline.includes("retired=state.decommissionedHardware?.[id]||0") && inline.includes("retired=state.decommissionedHardware?.[h.id]||0"), "Miner sale controls do not consistently use retired inventory");
assert(inline.includes("function facilityDeskSvg()") && inline.includes('floor-miner ${status} ${h.id==="laptop"?"laptop-desk":""}'), "Mining facilities no longer retain the laptop desk visual");
assert(css.includes('.tier-1 .floor-units,.tier-2 .floor-units{left:28px') && css.includes('.floor-miner.laptop-desk{position:absolute'), "Home-office miners are not arranged around the laptop desk and shelves");

const optionsStart = inline.indexOf("function hardwareQuantityOptions(");
const optionsEnd = inline.indexOf("\nfunction hardwareBuyControls(", optionsStart);
assert(optionsStart >= 0 && optionsEnd > optionsStart, "Mine purchase-option helper could not be extracted");
const optionsContext = { Number, Math, Set, fmtCompactNumber: (n) => String(n) };
vm.runInNewContext(inline.slice(optionsStart, optionsEnd), optionsContext);
for (const [maximum, expected] of [[0, [1]], [1, [1]], [2, [1, 2]], [5, [1, 2, 5]], [6, [1, 2, 5, 6]], [10, [1, 2, 5, 10]], [100, [1, 2, 5, 10, 100]], [150, [1, 2, 5, 10, 100, 150]]]) {
  const actual = optionsContext.hardwareQuantityOptions(maximum).map(option => option.qty);
  assert(JSON.stringify(actual) === JSON.stringify(expected), `Mine purchase quantities are wrong for a maximum of ${maximum}`);
  assert(new Set(actual).size === actual.length, `Mine purchase quantities contain duplicates for a maximum of ${maximum}`);
}
const controlsStart = inline.indexOf("function hardwareBuyControls(");
const controlsEnd = inline.indexOf("\nfunction mine(", controlsStart);
const controlsSource = inline.slice(controlsStart, controlsEnd);
assert((controlsSource.match(/<button/g) || []).length === 1, "A Mine card's unified buy control should render exactly one button");
assert(controlsSource.includes("data-hardware-qty") && controlsSource.includes("data-hardware-currency"), "Mine buy control is missing the quantity or currency selector");

assert(inline.includes("internet:45"), "Starter NA region internet bill is not the era-accurate residential figure");
// FORCED LAYOUT — reading offsetHeight mid-render forces a synchronous layout of the DOM the
// previous render wrote. Both sites use the value only to pin min-height while the scroll
// position is restored, so reading it when keepPosition is false is pure dead work.
assert(inline.includes("keepPosition?app.offsetHeight:0"),
  "render() reads offsetHeight unconditionally, forcing a layout whose result it discards");
assert(inline.includes("keepPosition?host.offsetHeight:0"),
  "renderMineContent() reads offsetHeight unconditionally, forcing a layout whose result it discards");
assert(!/,previousHeight=(app|host)\.offsetHeight;/.test(inline),
  "An unconditional offsetHeight read has come back into a render path");

// ORDER-BOOK DEPTH — the constraint that stops an early fortune being a free one.
assert(inline.includes("function tradeImpact("), "Order-book depth model is missing");
assert(inline.includes("function marketCapAt("), "Market capitalisation accessor is missing");
assert(inline.includes("const CAP=RECORDED.CAP"), "Recorded market cap series is not bound");
assert(/IMPACT_K\s*=\s*66/.test(inline), "Trade impact constant is not at its calibrated value");
assert(inline.includes("function addPressure(") && inline.includes("PRESSURE_HALFLIFE"),
  "Standing market pressure and its decay are missing, so slicing an order would dodge the impact");
assert(/sellBtc[\s\S]{0,400}tradeImpact\(/.test(inline), "sellBtc does not apply order-book impact");
assert(/buyBtc[\s\S]{0,400}tradeImpact\(/.test(inline), "buyBtc does not apply order-book impact");
assert(inline.includes("const impact=tradeImpact(btc*price,1);if(impact>0)addPressure(btc*price,1);")
  && inline.includes("const proceeds=btc*price*(1-fee)*(1-impact)"),
  "The automatic settlement sale does not pay order-book impact, making it a way around depth");
assert(/for\(let i=0;i<5&&btc>0;i\+\+\)\{const slip=tradeImpact\(/.test(inline),
  "The settlement sale does not solve for the impact it will itself cause, so it under-sells and leaves the bill short");
assert(inline.includes("marketPressure:{usd:0,at:0}"), "marketPressure is missing from the initial state");
assert(/state\.marketPressure=state\.marketPressure&&/.test(inline), "marketPressure has no save migration");
assert(inline.includes("transaction.depth"), "The confirmation modal does not show order-book impact before confirming");

assert(inline.includes("function hardwareFaultBreakdown(") && inline.includes("faultsByPart"), "Part-specific fault attribution is missing");
assert(inline.includes("function serviceHardwarePart(") && inline.includes('a==="service-part"'), "Targeted part-swap service action is not wired");
assert(inline.includes("PART_FAULT_LABELS"), "Part fault-cause labels are missing");
assert(inline.includes("function fleetServicingVisual()") && !inline.includes("function maintenanceVisual("), "Fleet servicing panel was not consolidated onto the Mine tab");
assert(inline.includes('data-action="focus-service"'), "Faulted floor sprites are not clickable to the servicing panel");
assert(inline.includes("Fleet health") && css.includes(".mine-top-metrics .metric-row"), "Fleet health metric tile is missing");
assert(!inline.includes("methodV2") && !inline.includes("methodV3"), "Redundant Method manual versions were not removed");
assert((inline.match(/data-anchor="method-/g) || []).length >= 4, "Mechanic cards are missing contextual links into Method");
assert(inline.includes('id:"fieldservice"') && inline.includes('branch:"Operations"'), "Field service technique skill is missing");
assert(inline.includes("const REPAIR_STAGES=[") && inline.includes('id:"stabilitycheck"'), "Multi-stage repair labour model is missing");
assert(inline.includes("job.stageDue") && inline.includes("REPAIR_COMPLICATIONS"), "Repair-stage complications are not wired into advanceMaintenance");
assert(inline.includes("contractorBusy"), "Contractor throughput cap is missing");
assert(inline.includes("fault spreading") || inline.includes("Fault spreading"), "Idle-fault escalation is missing");
assert(inline.includes('a==="toggle-overdrive"') && inline.includes("state.overdrive"), "Overdrive toggle is not wired");
assert(inline.includes("Load penalty") && css.includes(".energy-tariff-desk .metric-row"), "Energy load-penalty tile is missing");
assert(inline.includes("pending.resumeSpeed||state.returnSpeed||0") && inline.includes("resumeSpeed=state.speed||state.returnSpeed||0") && inline.includes("p.resumeSpeed||state.returnSpeed||0"), "Settlement/receivership speed-resume still falls back to 1 instead of 0");
assert(inline.includes("settlementSaleMode") && !inline.includes("function payPendingWithBtc"), "Settlement BTC rescue was not routed through the Market exchange flow");
assert(inline.includes('a==="cancel-settlement-sale"') && inline.includes("settlementBanner"), "Settlement sale-mode escape hatch or persistent banner is missing");
assert(inline.includes("state.pendingSettlement&&!state.settlementSaleMode?settlementModal()"), "Settlement modal is not gated by settlementSaleMode");
assert(inline.includes("MARKET_VENUES") && css.includes(".exchange-ticket-quote") && css.includes(".ticket-side.buy"), "Exchange trade-ticket redesign is missing");
assert(inline.includes('selectedVenue="mtgox"') && inline.includes('a==="select-venue"') && inline.includes("venueCard(selectedVenue)"), "Market tab no longer shows one selected venue ticket at a time");
assert(inline.includes('set("live-network-hash",fmtHash(competitiveHashAt(state.time,fs.hash)))') && inline.includes("competitiveHashAt(state.time,fs.hash))}</div><div class=\"subvalue\">recorded + unseen-miner floor"), "Displayed network hash no longer matches the effective competitive figure used for mining odds");
assert(inline.includes("function triggerImpactEffect()") && inline.includes('showToast(title,message,kind="info",tab=null,anchor=null)'), "Bad-event impact effect is not wired into showToast");
assert(css.includes(".impact-flash{") && css.includes(".impact-shake{") && css.includes(".toast.toast-bad{"), "Impact-flash/shake CSS is missing");
assert((inline.match(/,"bad"[,)]/g) || []).length >= 12, "Not enough bad-event call sites trigger the impact effect");
assert(inline.includes("state.facilityUpgradeJob={id,due:state.time+Math.ceil(days)*DAY,cost:f.cost,risk}") && inline.includes("function upgradingFacility()") && inline.includes("function fleetGrounded()"), "Facility upgrades no longer resolve as a timed, power-down job");
assert(inline.includes("const upgradeJob=state.facilityUpgradeJob;if(upgradeJob&&upgradeJob.due<=state.time)"), "Facility-upgrade job is not resolved in the fleet lifecycle tick");
assert(inline.includes("busy=move||upgradeJob") && inline.includes('upgradeJob?"Upgrade in progress"'), "Facilities tab does not block new moves while a facility upgrade is in flight");
assert(inline.includes('<span>Internet</span><strong style="color:${netDown?"var(--red)":"var(--green)"}">') && inline.includes('<span>Grid power</span><strong style="color:${powerDown?"var(--red)":"var(--green)"}">'), "Mining floor is missing visual internet/power status tiles");
assert(css.includes(".thermal-console{display:grid;grid-template-columns:repeat(4,minmax(0,1fr))"), "Thermal console grid was not widened for the new status tiles");

const sandboxContext={};
vm.runInNewContext(timelineSource.replace("const SANDBOX_END","var SANDBOX_END").replace("const OPERATOR_ERAS","var OPERATOR_ERAS"), sandboxContext);
assert(sandboxContext.SANDBOX_END===4943721600000, "SANDBOX_END drifted from the intended ~100-year horizon");
assert(sandboxContext.OPERATOR_ERAS.length===7 && sandboxContext.OPERATOR_ERAS[6].id==="frontier2", "Procedural-frontier operator era is missing or out of place");
assert(/performance=eraPoints\/\(OPERATOR_ERAS\.length\*100\)\*\d+/.test(inline), "Operator performance subscore still divides by a hardcoded era count");
assert(inline.includes("next>=SANDBOX_END&&state.sandbox&&!state.pendingSettlement") && inline.includes('state.endReason="sandbox-complete"'), "Sandbox continuation has no second, finite auto-end trigger");
assert(inline.includes('body.querySelector(\'[data-action="continue-run"]\')||state.endReason||state.time<END)return'), "The sandbox continuation must only be offered to a run that actually reached the recorded cutoff: a receivership in 2017 was being told the historical feed had ended");
assert(inline.includes("function futurePriceAt(") && inline.includes("function futureHashAt(") && inline.includes("function futureHeightAt(") && inline.includes("function futureChainSizeAt("), "Procedural continuation model for price/hash/height/chain-size is missing");
assert(!inline.includes("nextRand()") || !inline.slice(inline.indexOf("function futurePriceAt("), inline.indexOf("function futurePriceAt(")+2000).includes("nextRand()"), "Procedural price model must stay a pure function of time, not the live gameplay PRNG");
// Bitcoin issues whole satoshis. The 100-year continuation projects roughly
// twenty-five further halvings, and by the endpoint the subsidy is single-digit
// satoshis — exactly where a 50/2**n model starts paying fractions of a unit
// that cannot exist.
const historySource = await readFile(new URL("src/engine/history.js", root), "utf8");
const subsidySliceStart = historySource.indexOf("const FUTURE_HALVING_INTERVAL=");
const subsidySliceEnd = historySource.indexOf("function feeAt(", subsidySliceStart);
assert(subsidySliceStart >= 0 && subsidySliceEnd > subsidySliceStart, "The subsidy and halving-schedule block could not be extracted from history.js");
const subsidyContext = { Math, Date, Number };
vm.runInNewContext(
  timelineSource + "\n" + historySource.slice(subsidySliceStart, subsidySliceEnd) +
  "\nglobalThis.subsidyApi={subsidyAt,subsidySatsAt,subsidyHalvingIndex,halvingTimeAt,halvingIsProjected,nextHalvingTime,END,SANDBOX_END,DAY};",
  subsidyContext
);
const subsidy = subsidyContext.subsidyApi;
const firstProjectedHalving = subsidy.halvingTimeAt(5);
assert(subsidy.halvingIsProjected(5) && !subsidy.halvingIsProjected(4), "The fourth halving is recorded history; the fifth is the first projection");
assert(firstProjectedHalving > subsidy.END, "The first projected halving must fall after the recorded historical cutoff");
assert(new Date(firstProjectedHalving).toISOString().slice(0, 7) === "2028-04", "The first projected halving drifted away from April 2028");
assert(subsidy.subsidyAt(firstProjectedHalving - subsidy.DAY) === 3.125 && subsidy.subsidyAt(firstProjectedHalving) === 1.5625, "The first projected halving must take the subsidy from 3.125 BTC to 1.5625 BTC");
assert(subsidy.subsidyAt(firstProjectedHalving) === subsidy.subsidyAt(firstProjectedHalving + subsidy.DAY), "Mining rewards must use the reduced subsidy from the halving boundary onward, not a day later");
let projectedHalvings = 0;
for (let index = 5; subsidy.halvingTimeAt(index) <= subsidy.SANDBOX_END; index += 1) {
  const boundary = subsidy.halvingTimeAt(index);
  const before = subsidy.subsidySatsAt(boundary - subsidy.DAY);
  assert(subsidy.subsidySatsAt(boundary) === Math.floor(before / 2), "Projected halving " + index + " does not halve the subsidy on its own boundary");
  projectedHalvings += 1;
}
assert(projectedHalvings === 25, "The sandbox should contain 25 projected halvings, not " + projectedHalvings);
for (let t = subsidy.END; t <= subsidy.SANDBOX_END; t += subsidy.DAY * 7) {
  const sats = subsidy.subsidySatsAt(t);
  const day = new Date(t).toISOString().slice(0, 10);
  assert(Number.isInteger(sats) && sats >= 0, "The projected subsidy is not a whole number of satoshis at " + day);
  assert(Math.round(subsidy.subsidyAt(t) * 1e8) === sats, "The BTC subsidy and its satoshi value disagree at " + day);
}
assert(subsidy.subsidySatsAt(subsidy.SANDBOX_END) === 9, "By the 100-year endpoint the projected subsidy should be nine satoshis per block");
assert(subsidy.subsidyAt(subsidy.SANDBOX_END + subsidy.DAY * 365 * 200) === 0, "The subsidy must reach zero rather than pay a fraction of a satoshi");
assert(inline.includes("function fmtSubsidy(") && inline.includes("fmtSubsidy(subsidyAt(state.time))"), "The subsidy readout does not use the satoshi-aware formatter, so late-sandbox values render in scientific notation");
assert(inline.includes('log("Projected protocol halving"') && inline.includes("Modelled, not recorded: subsidy"), "The sandbox halving Ledger entry must be labelled as a projection, not as recorded history");
assert(inline.includes('showToast("Projected protocol halving"') && inline.includes("Review your mining margin"), "The sandbox halving notification must name the projection and recommend reviewing mining margin");
assert(inline.includes('notice:"Rules change"') && css.includes(".toast.toast-notice{") && inline.includes('earns half the subsidy it did yesterday.`,"notice","mine")'), "A halving that has already cut the subsidy must not be labelled an advance warning; it needs the rules-change kind");
// The continuation decision has to say all four things before the player commits:
// what stops, what continues as a model, that the model is deterministic, and that
// the issuance schedule keeps cutting mining income on projected dates.
assert(inline.includes("function sandboxContinuationNote()") && inline.includes('insertAdjacentHTML("beforebegin",sandboxContinuationNote())'), "The sandbox continuation decision no longer explains itself before the player commits");
assert(["Stops at the cutoff", "Continues as a model", "Continues as protocol"].every(label => inline.includes(label)), "The sandbox decision no longer separates what stops, what is modelled and what is protocol");
assert(inline.includes("No new historical chapters and no new hardware releases are invented"), "The sandbox decision must state that no new recorded news or hardware is invented after the cutoff");
assert(inline.includes("chain size and block height continue through deterministic modelled projections"), "The sandbox decision must name the series that continue procedurally");
assert(inline.includes("constant ten-minute block interval"), "Projected halving dates must be attributed to the constant ten-minute block interval that produces them");
assert(inline.includes('id:"sandbox-start"') && inline.includes('anchor:"method-sandbox"'), "The first sandbox briefing is missing, or no longer links to the Method sandbox chapter");
assert(inline.includes('${tip.anchor?`data-anchor="${tip.anchor}"`:""}'), "Operator briefings can no longer deep-link to a Method chapter");

const contentSource = await readFile(new URL("src/data/content.js", root), "utf8");
const eventsStart = contentSource.indexOf("const EVENTS=[");
const eventsSource = contentSource.slice(eventsStart, contentSource.indexOf("\n];", eventsStart));
const hardwareSource = await readFile(new URL("src/data/hardware.js", root), "utf8");
for (const [label, source] of [["historical event", eventsSource], ["hardware release", hardwareSource]]) {
  for (const [, date] of source.matchAll(/date:"(\d{4}-\d{2}-\d{2})"/g)) {
    assert(Date.parse(date + "T00:00:00Z") <= subsidy.END, "A " + label + " is dated " + date + ", after the recorded cutoff — the sandbox must not invent recorded history");
  }
}

assert(inline.includes('["Effective fee",state.mode==="pool"?'), "Pools quick-stat strip shows a fee while solo mining");
assert(inline.includes("function poolClosed(") && inline.includes('closed:"2013-06-30"') && inline.includes('state.mode==="pool"&&poolClosed(state.pool)') && inline.includes("function miningConnectionPanel()"), "Pool shutdown fail-over to solo mining is missing");
assert(inline.includes("t>=at(p.date)&&!poolClosed(p.id,t)"), "The dashboard pool-concentration chart bypasses the pool-closure filter");
assert(inline.includes('percentageControl("custody-transfer"') && inline.includes('data-percent-id="custody-transfer"'), "Custody hot/cold transfer no longer uses a single one-shot slider");
assert(inline.includes("lightningBadge=lightningOk?") && inline.includes('locked"}"><div class="card-head"><h2>Lightning routing liquidity'), "Lightning card is not visually gated before it unlocks");
assert(inline.includes("function refreshMarket()") && inline.includes('id="market-price-headline"') && inline.includes("data-live-bid"), "Market tab price no longer refreshes on the cheap live-tick path");
assert(inline.includes("const TX_COUNT=Math.max(0,Math.min(300,txDay))"), "Mempool 'next block' mosaic no longer scales with real transaction volume");
assert((inline.match(/title="\$\{/g) || []).length >= 20, "Not enough disabled controls explain themselves on hover");
assert(/if\(!needsFull&&state\.started&&!state\.activeEvent&&!state\.ended\)refreshLive\(\);else renderMineContent\(\);/.test(inline), "Fault-driven full renders no longer route through the scroll-coordinated Mine path");
assert(inline.includes("setTimeout(()=>requestAnimationFrame(paint),delay)"), "Queued renders are no longer frame-aligned, which is what made 16x speed jitter");
assert(inline.includes("state.speed>=16?600:"), "The high-speed render throttle is gone; faster clocks must repaint less often, not more");
assert(inline.includes("function captureScrollAnchor()") && inline.includes("function restoreScrollAnchor(anchor)") && inline.includes("const anchor=keepPosition?captureScrollAnchor():null"), "Repaints no longer anchor on the card the reader is looking at, so content inserted above the viewport will silently push the page down");
assert(inline.includes("save();renderMineContent();") && !/log\("Spare parts ordered"[^;]*\);save\(\);render\(\);/.test(inline), "Ordering spare parts still rebuilds the whole page instead of patching the Mine tab");
assert(inline.includes("now-lastImpactAt<4000") , "The bad-event screen shake is no longer throttled, so a run of faults throws the page around");
const renderScrolls = (renderSource.match(/window\.scroll(?:To|By)\(\{[^}]*\}/g) || []);
assert(renderScrolls.length>=3 && renderScrolls.every(call => call.includes('behavior:"instant"')), "Every scroll restore in the render path must be instant, or it visibly animates during a fault burst (user-initiated smooth scrolling in events.js is fine)");
assert(inline.includes('if(stage.id==="work"&&!job.auto&&job.contracted&&!job.workDone){') && inline.includes("job.oldRemoved=!job.part;"), "Full-refurbishment jobs no longer get a manual repair puzzle alongside targeted part swaps");
assert(!inline.includes("function asicEfficiencyTimelineHtml(") && inline.includes("Best available efficiency"), "ASIC efficiency table was not folded into the profitability desk");
assert(inline.includes("forecast.cashAfter<0?") && inline.includes('class="status-banner forecast-warning-banner"'), "Proactive cash-shortfall warning banner is missing");
assert(inline.includes("function connectivityPingMs()") && inline.includes("ms to ${state.mode"), "Mining floor is missing a connectivity ping reading");
assert(inline.includes("function incomingFleetVisual()") && !inline.includes("function quickCommission") && inline.includes('class="card span-12 incoming-fleet"'), "Order/commissioning pipeline was not unified into one prominent view");
assert(inline.includes("faultedFraction>.05") && inline.includes("openFaultFraction>.05") && !inline.includes('health<65||faults?"var(--red)"') && !inline.includes('avgHealth<65||openFaults?"var(--red)"'), "Fleet health colors are still presence-based instead of proportional to fleet size");
assert(inline.includes("const MILESTONES=[") && inline.includes('id:"centurion"') && inline.includes("check:()=>state.time>=SANDBOX_END"), "Milestone roster was not extracted into a top-level data array");
assert(inline.includes("state.milestoneLog.push({id:m.id,time:state.time})") && inline.includes('log(`Milestone: ${m.label}`,"+1 skill point","milestone")'), "Milestone hits are not timestamped and categorised");
assert(inline.includes('toast-${kind}') && inline.includes('milestone:"Milestone reached"') && css.includes(".toast.toast-milestone{"), "Milestone toasts do not get distinct styling and language from bad-event toasts");
assert(inline.includes("(state.milestones?.length||0)/MILESTONES.length*80"), "Milestone score component still divides by a hardcoded count instead of the roster length");
assert(inline.includes('e.fx==="computenorthx"') && inline.includes('e.fx==="corescix"') && inline.includes('e.fx==="riotx"'), "Rival lifecycle events are not wired into applyEvent");
assert(inline.includes("state.hardwareGlut&&state.time<state.hardwareGlut.until?1-state.hardwareGlut.discount:1") && inline.includes("h.cost*retained*market*glut"), "Hardware resale value does not react to a rival bankruptcy glut");
assert(inline.includes('const CAREER_KEY="hashrate-career-v1"') && inline.includes("function recordCareerRun()") && inline.includes("function loadCareer()"), "Cross-run career persistence is missing");
assert(inline.includes("function runRecap()") && inline.includes('class="run-recap"') && inline.includes("${runRecap()}${careerSummaryHtml(\"end\")}"), "End-of-run narrative recap is missing from the end screen");
assert(inline.includes('${careerSummaryHtml("intro")}'), "Career summary is missing from the campaign-start screen");
assert(inline.includes("function rivalLandscapeCard()") && inline.includes("RIVAL_OPERATORS") && inline.includes("${rivalLandscapeCard()}"), "Rival operator landscape card is missing from Pools");
assert(inline.includes("function milestonesLedgerSection()") && inline.includes("${milestonesLedgerSection()}"), "Milestone list is missing from the Ledger tab");
assert(inline.includes("const WALLET_SOFTWARE=[") && inline.includes('id:"modern"') && inline.includes("function walletSoftwareTierAt("), "Wallet software lineage data or tier-lookup helper is missing");
assert(inline.includes("function rollDie()") && inline.includes("crypto.getRandomValues"), "Dice-roll entropy ceremony is not using real browser randomness");
assert(inline.includes("function walletSetupModal()") && inline.includes("state.started&&!state.walletSetup.done?walletSetupModal()"), "Wallet-setup ceremony is not wired into the modal stack");
assert(inline.includes('log(`Upgraded to ${tier.name}`,"+1 skill point","milestone")') && inline.includes('showToast(`Upgraded to ${tier.name}`') , "Wallet-software upgrades do not use the milestone reward convention");
assert(!inline.includes('"Bitcoin Core runs on the Basic laptop') && !inline.includes('"Bitcoin Core shares the mining laptop"'), "Wallet-client copy is still hardcoded to Bitcoin Core regardless of the in-game date");
assert(inline.includes("function walletClientCard()") && inline.includes("${walletClientCard()}${backupNodeCard()}"), "Custody is missing the Wallet client upgrade card");
assert(inline.includes('state=initialState();OPERATOR_ERAS.forEach(era=>state.operator.eras[era.id]={months:0,solvent:0,profitable:0,uptime:0,competitive:0});migrateActivity(state)'), "resetGame() no longer seeds per-era operator stats, which crashes the dashboard's Operator Score card on New run");
assert(inline.includes('id:"cryptomailinglist"') && inline.includes('date:"2008-10-31"') && inline.includes('id:"bitcoindev"'), "The real cryptography-mailing-list and bitcoin-dev learning items are missing or misdated");
assert(inline.includes('awardLearning(LEARNING.find(x=>x.id==="cryptomailinglist"))'), "The cryptography mailing list is not auto-credited at campaign start");
assert(inline.includes("function buildQueueCard()") && inline.includes("${buildQueueCard()}"), "Dashboard is missing the unified build-queue card");
assert(inline.includes('if(stage.id==="work"&&!job.auto&&job.contracted&&!job.workDone){') && inline.includes('awaitingInput=!!(job&&!job.auto&&job.contracted&&') && inline.includes('const workPuzzle=job&&!job.auto&&job.contracted&&'), "You must be the one servicing your own kit before technicians are hired: the manual puzzle belongs to self-serviced jobs, not to a hired technician crew");
assert(inline.includes("function initRepairPuzzle(job)") && inline.includes("function repairPuzzleRequired(job)") && inline.includes("if(repairPuzzleRequired(state.maintenance.serviceJobs[state.maintenance.serviceJobs.length-1]))initRepairPuzzle("), "Repair-puzzle state is not initialised at job creation, so the puzzle can render with dead controls until the clock advances past the Work stage");
assert(!inline.includes("An outside contractor is already covering another repair") && !inline.includes("An external technician is covering the job.") && !inline.includes("outside contractors cost 35% more"), "Self-serviced repairs still tell the player an outside contractor is doing work they have to perform themselves");
assert(inline.includes("byPart[job.part]=0;") && inline.includes("hardwareFaultCount(h)>0?boosted:Math.max(70,boosted)"), "A completed targeted part-swap no longer fully clears that part's fault count, or lost its headroom over the same-tick wear pass that would otherwise erode it back under the 65% offline threshold");
assert(inline.includes("function faucetMarkup(") && inline.includes('host.insertAdjacentHTML("beforeend",faucetMarkup(faucet))') && !inline.includes("faucetTimer=setTimeout(()=>{faucet=null;render()}"), "The Bitcoin Faucet popup forces a full page re-render instead of a targeted DOM patch");
assert(inline.includes('id:"laptopfan"') && inline.includes('id:"asicfan"') && inline.includes('id:"hashboardearly"') && inline.includes('id:"hashboardmodern"') && inline.includes("function hashboardTierFor(") && inline.includes("function fanTierFor("), "Tiered, era-scaled spare parts are missing");
assert(inline.includes('"Block reward (today)"') && inline.includes("`Block reward ×${blocks} (today)`"), "Solo block-reward ledger label no longer clarifies it's the day's total, not a single block's reward");
assert(inline.includes('if(activeTab==="dashboard"&&state.speed>0)refreshDashboardVisuals()'), "The mempool/dashboard live-refresh timer no longer respects pause");
assert(inline.includes("const EXPOSURE_WARNINGS=[") && inline.includes('id:"mtgoxwarn"') && inline.includes('id:"quadrigawarn"') && inline.includes('id:"ftxwarn"') && inline.includes('id:"chinawarn"'), "The historically-grounded exposure warnings are missing");
assert(!inline.includes('id:"bitfinexwarn"') && !inline.includes('id:"kazakhwarn"'), "Bitfinex's 2016 hack and Kazakhstan's 2022 blackout had no genuine public advance warning and must not be given a fabricated one");
assert(inline.includes("function queueExposureWarnings(prev,next)") && inline.includes("queueExposureWarnings(prev,next);") && inline.includes("state.exposureWarned.push(w.id)"), "Exposure warnings are not fired from tick(), or no longer track their own one-time state");
assert(!inline.includes("state.seen.push(w.id)"), "An exposure warning must never mark its event id in state.seen — that would make the real collapse silently skip applyEvent()");
assert(inline.includes('warning:"Advance warning"') && inline.includes('toast-${kind}') && css.includes(".toast.toast-warning{") && css.includes(".exposure-warning-banner{"), "The amber 'warning' toast kind is missing its markup branch, label or styling");
assert(inline.includes("exposureBanners=EXPOSURE_WARNINGS.filter(") && inline.includes("${forecastBanner}${exposureBanners}"), "The persistent exposure-warning banner is not computed or not spliced into the banner family");
assert(inline.includes("restored.exposureWarned=Array.isArray(restored.exposureWarned)?restored.exposureWarned:[]"), "importSave() does not guard the exposureWarned array");
assert(inline.includes('id:"benchskills"') && inline.includes('id:"partssourcing"') && inline.includes('id:"supplychain"') && inline.includes('id:"practisedhands"') && !/id:"(benchskills|partssourcing|supplychain|practisedhands)"[^}]*minFacility/.test(inline), "The four hardware self-help skills are missing, or gated behind a facility tier that would force the player to hire instead");
assert(inline.includes("labor=plan.contracted?0:Math.max(40") && inline.includes("labor=plan.contracted?0:Math.max(25"), "Servicing your own fleet must not charge fiat labour — only a technician crew is paid");
assert(inline.includes("function selfDamageChance(h)") && inline.includes("function selfRepairMistake(job,message)") && inline.includes("selfRepairMistake(job,"), "Fumbling a self-serviced repair no longer risks damaging the machine");
assert(inline.includes("function selfRepairExperience(id)") && inline.includes("store[job.id]=selfRepairExperience(job.id)+1"), "Completed self-serviced repairs no longer build per-hardware experience, so the damage risk cannot decay with practice");
assert(inline.includes("function selfAutoCompleteChance(h)") && inline.includes("if(job.selfAuto){completeRepairWork("), "Practised hands cannot auto-finish a familiar self-serviced repair");
assert(inline.includes("function sparePartCost(part)") && inline.includes('hasSkill("partssourcing")?.8:1') && inline.includes("function partsLeadDays()") && inline.includes('hasSkill("supplychain")?.6:1'), "Spare-part pricing or restock lead time no longer responds to the sourcing and supply-chain skills");
assert(inline.includes("function dismissStaff(id)") && inline.includes('a==="dismiss-staff"') && inline.includes("state.billLedger.staff=(state.billLedger.staff||0)+role.salary") && inline.includes("if(!techs&&state.autoRepair)state.autoRepair=false"), "Staff cannot be dismissed, dismissal is free of notice cost, or losing the last technician leaves auto-repair stuck on");
assert(inline.includes("function selfServiceBench(owned)") && inline.includes("${selfServiceRelevant()?selfServiceBench(owned):\"\"}") && inline.includes("function selfServiceRelevant()") && css.includes(".self-service-bench{"), "The Mine floor is missing the self-service bench panel, its styling, or the check that shows it whenever no technician is free");
assert(inline.includes("function operatorLevel(total)") && inline.includes("function xpForLevel(level)") && inline.includes("function levelAwardsPoint(level)") && inline.includes("function awardXp(amount,source)"), "The operator XP model is missing");
const operatorIdx = appScripts.indexOf("src/engine/operator.js"), simulationIdx = appScripts.indexOf("src/engine/simulation.js");
assert(operatorIdx >= 0 && simulationIdx >= 0 && operatorIdx < simulationIdx, "src/engine/operator.js must load BEFORE src/engine/simulation.js: the migration block calls normalizeXp() at the top level, and reversing them aborts the whole engine on load");
assert(/const XP_LEVEL_STEP=60,SHARE_WORK=4294967296;/.test(operatorSource) && !/const XP_LEVEL_STEP/.test(simulationSource), "The XP constants belong in operator.js alongside the functions that use them");
assert(inline.includes('awardXp(1.2*Math.log2(1+shares),"shares")') && inline.includes('"record")') && inline.includes('"deploy")') && inline.includes('"repair")'), "XP is no longer earned from all four sources (shares, best-share records, deployment, repairs)");
assert(inline.includes("Math.log2") && inline.includes("function dailyShareCount(hash)"), "Share XP must stay logarithmic in hashrate, or an eleven-order-of-magnitude fleet range breaks the curve");
assert(inline.includes("if(levelAwardsPoint(level)){state.points++"), "Levelling up no longer grants skill points");
assert(inline.includes("mastery=Math.min(60,Math.max(0,(state.xp?.peakLevel||1)-1)/49*60)") && inline.includes("performance=eraPoints/(OPERATOR_ERAS.length*100)*740") && inline.includes("Math.round(performance+mastery+milestones+holdings+balance+resilience)"), "Peak operator level no longer augments the Operator Score, or the 1,000-point total no longer balances");
assert(inline.includes("function normalizeXp(raw)") && inline.includes("state.xp=normalizeXp(state.xp)") && inline.includes("restored.xp=normalizeXp(restored.xp)"), "XP state is not normalised on load or on import");
assert(inline.includes('id="live-xp-fill"') && inline.includes('set("live-xp-level"') && css.includes(".xp-meter{") && css.includes(".xp-track i{"), "The header XP bar is missing, or no longer updates on the live tick");
assert(/@media\(max-width:900px\)\{\.topbar\{position:relative\}\.xp-meter\{position:absolute/.test(css), "The narrow-screen XP bar must collapse to a hairline strip under the topbar, or it squeezes the brand and clock into each other");
assert(inline.includes('class="xp-breakdown"') && inline.includes("Best-share records"), "The dashboard XP source breakdown is missing");
const minerArtBody = (inline.match(/function minerSvg\(id\)\{[\s\S]*?\n  return/) || [""])[0];
assert(minerArtBody && !/\(\s*id===\"[^\"]+\"\s*\|\|\s*id===\"[^\"]+\"/.test(minerArtBody), "Two hardware ids share one miner drawing — every machine needs its own art (this is how the Radeon HD 5870 and the six-GPU open rig ended up identical)");
assert(minerArtBody.includes('id==="gpurig"?'), "The six-GPU open rig no longer has its own drawing");
// Payout schemes were invented at particular moments. A pool must never be
// shown running one before it existed — that is exactly the kind of detail a
// mining audience checks first.
const poolsSource = await readFile(new URL("src/data/network.js", root), "utf8");
const SCHEME_INVENTED = { prop: "2010-01-01", score: "2010-11-01", pplns: "2011-01-01", pps: "2011-01-01", fpps: "2014-01-01", ppsplus: "2016-08-01", tides: "2023-11-28", solo: "2009-01-03" };
const schemeRows = [...poolsSource.matchAll(/schemes:\[(.*?)\]\]/gs)].map(m => m[1] + "]");
assert(schemeRows.length >= 14, "Pool payout schemes are no longer expressed as dated timelines");
const anachronisms = [];
for (const row of schemeRows) {
  for (const entry of row.matchAll(/\["(\d{4}-\d{2}-\d{2})","(\w+)",([\d.]+)\]/g)) {
    const [, date, scheme] = entry;
    assert(SCHEME_INVENTED[scheme], `Unknown payout scheme "${scheme}" in a pool timeline`);
    if (Date.parse(date) < Date.parse(SCHEME_INVENTED[scheme])) anachronisms.push(`${scheme} at ${date}`);
  }
}
assert(anachronisms.length === 0, `A pool runs a payout scheme before that scheme existed: ${anachronisms.join(", ")}`);
assert(inline.includes("function poolTermsAt(id=state.pool,t=state.time)") && inline.includes("function poolFeeAt(id,t)"), "Pool fees and schemes are no longer resolved against the in-game date");
assert(/slush[\s\S]{0,120}"score"[\s\S]{0,60}"2023-12-12","fpps"/.test(poolsSource), "Slush ran a score-based payout from 2010 and only moved to FPPS on 12 December 2023");
assert(/viabtc[\s\S]{0,120}"2016-08-01","ppsplus"/.test(poolsSource), "ViaBTC invented PPS+ in August 2016; its timeline should reflect that");
const orientationTabs = ["mine","pools","market","custody","facilities","energy","finance","learn","tech","ledger","method"];
assert(inline.includes('class="card section-pulse section-orientation"') && inline.includes("What this page is for") && inline.includes("Current situation") && inline.includes("Recommended next step") && inline.includes("Why it matters"), "The reusable page-orientation structure is missing a required decision layer");
assert(orientationTabs.every(tab=>new RegExp(`(?:^|\\s)${tab}:\\{purpose:`).test(inline)), "One or more non-Dashboard tabs is missing its page purpose and state-aware orientation copy");
assert(css.includes(".section-orientation{") && css.includes(".orientation-guide{") && css.includes("@media(max-width:700px){.orientation-intro"), "Page orientation is missing its desktop or mobile layout");
assert(inline.includes("Your machines are mining.") && inline.includes("Self-held BTC") && inline.includes("BTC held by others") && inline.includes("Site power used"), "Dashboard still relies on technical or ambiguous labels instead of the Phase 3 operating language");
assert(inline.includes("Choose machines that can earn more than they cost to run.") && inline.includes("A pool combines many miners' work") && inline.includes("Your keys decide who can spend your bitcoin.") && inline.includes("Know what today's mining load costs."), "A core operating tab has lost its newcomer-readable Phase 3 entry copy");
assert(inline.includes("const PAGE_HELP={") && orientationTabs.every(tab=>new RegExp(`(?:^|\\s)${tab}:\\{anchor:\"method-`).test(inline)), "One or more operating tabs is missing reusable contextual help or a Method destination");
assert(inline.includes("function contextualHelp(tab)") && inline.includes("Terms and help") && inline.includes("What do these numbers mean?") && inline.includes("How ${help.label} works in this simulation"), "The expandable contextual-help component is missing its definition or simulation-reference layers");
assert(inline.includes("function enhanceDisabledControls()") && inline.includes('button.action:disabled') && inline.includes('a==="blocked-help"') && inline.includes("Why this is unavailable"), "Disabled actions do not expose a touch-accessible blocker explanation");
assert(inline.includes('control.setAttribute("aria-describedby",id)') && inline.includes('description.className="sr-only"') && css.includes(".blocked-help{") && css.includes(".sr-only{"), "Blocked-action help is missing its accessible description or visible touch target");
// Method is eight named chapters behind a table of contents. Chapter ids and section
// ids are written into the markup rather than matched by heading text at runtime, and a
// deep link has to open the collapsed chapter it points inside before it can scroll to it.
assert(inline.includes('data-value="method" data-anchor="${help.anchor}"') && inline.includes('else if(a==="tab"){activeTab=v') && inline.includes("setTimeout(()=>revealMethodAnchor(anchor),60)"), "Contextual help cannot deep-link to the relevant Method chapter");
assert(inline.includes("function revealMethodAnchor(id)") && inline.includes('if(node.tagName==="DETAILS")node.open=true'), "A deep link into a collapsed Method chapter cannot scroll to a target the browser is still hiding");
assert(!inline.includes("ensureMethodAnchors"), "Method anchors are written into the markup now; the runtime heading-text matcher must not come back");
const methodSource = await readFile(new URL("src/ui/tabs/method.js", root), "utf8");
const methodChapterIds = [...methodSource.matchAll(/\{id:"(method-[a-z]+)",title:/g)].map(match => match[1]);
assert(methodChapterIds.length === 8, `Method should open as eight named chapters, not ${methodChapterIds.length}`);
assert(methodChapterIds[0] === "method-start" && methodChapterIds[7] === "method-sandbox", "Method must open on Start here and close on the procedural sandbox");
assert(inline.includes("function methodTocHtml(chapters)") && inline.includes('data-action="method-chapter"') && inline.includes('else if(a==="method-chapter")revealMethodAnchor(id)'), "The Method table of contents is missing, or its links do not open the chapter they name");
assert(inline.includes('<details class="method-chapter" id="${chapter.id}"') && inline.includes("method-chapter-lead"), "Method chapters are no longer collapsible, or have lost their plain-language lead");
// Exact formulas belong behind a disclosure, not in the first thing a newcomer reads.
const methodDetails = (methodSource.match(/<details class="method-detail">/g) || []).length;
assert(methodDetails >= 8, `Method should keep its exact calculations behind a disclosure; only ${methodDetails} sections do`);
assert(css.includes(".method-detail{") && css.includes(".method-detail>summary{cursor:pointer") && css.includes(".method-detail>summary{min-height:40px}"), "Method detail disclosures are missing their styling or their mobile touch target");
assert(inline.includes("function methodDetailIds(body,chapterId)") && inline.includes('e.target.classList?.contains("method-detail")'), "An opened Exact calculation must survive a repaint like the chapter around it");
for (const heading of ["method-mining", "method-energy", "method-facilities", "method-connectivity", "method-firmware"]) {
  const start = methodSource.indexOf(`id="${heading}"`);
  const end = methodSource.indexOf("<h3", start + 1);
  assert(methodSource.slice(start, end < 0 ? undefined : end).includes('<details class="method-detail">'), `The ${heading} section still puts its exact calculation in the first thing a newcomer reads`);
}
assert(inline.includes("const methodOpenChapters=new Set([\"method-start\"])") && inline.includes('${methodOpenChapters.has(chapter.id)?"open":""}') && inline.includes('e.target.classList?.contains("method-chapter")||e.target.classList?.contains("method-detail")'), "A chapter the reader opened must survive the next simulation tick; render() rebuilds the tab from a template and would otherwise snap it shut");
assert(inline.includes('data-help-tab="${tab}" ${openContextHelp.has(tab)?"open":""}') && inline.includes('e.target.classList?.contains("context-help")'), "An opened Terms and help disclosure must survive a repaint for the same reason a Method chapter does");
assert(["method-mining","method-hardware","method-maintenance","method-firmware","method-energy","method-facilities","method-connectivity","method-market","method-custody","method-xp","method-progression","method-finance","method-risk","method-events","method-reference","method-ledger"].every(id => methodSource.includes(`id="${id}"`)), "A mechanic lost its precise Method section target");
assert(inline.includes("function recordedMetricSnapshot()") && !inline.includes("alpha25EnhanceMethod") && !inline.includes("alpha24EnhanceMethod"), "Dataset provenance belongs in the Method sources chapter, not in a stack of bootstrap innerHTML patches");
assert(["What stops at the cutoff","What continues as a model","What continues as protocol","Whole satoshis"].every(heading => methodSource.includes(heading)), "The procedural-sandbox chapter no longer separates what stops, what is modelled, what is protocol and how satoshis are floored");
assert(inline.includes("function feedbackKind(") && inline.includes("function feedbackLabel(") && ["Action needed","Advance warning","Cannot do that","Milestone reached","Completed"].every(label=>inline.includes(label)) && inline.includes('aria-live="${assertive?"assertive":"polite"}'), "Phase 5 feedback has lost its semantic kinds, human-readable status labels or accessible live-region priority");
assert(css.includes(".toast.toast-success{") && css.includes(".toast.toast-blocked{") && inline.includes("Open ${escapeHtml(t.tab)}"), "Success and blocked feedback lack distinct styling or a clear destination action");
assert(inline.includes("function transactionImpact(transaction)") && inline.includes("Operational consequence") && inline.includes("You give now") && inline.includes("Position afterward"), "Transaction review no longer separates the immediate exchange, operational consequence and resulting position");
assert(inline.includes("function eventGameplayEffect(e)") && ["What happened","Why it mattered","Effect on your operation","CONTEXT · NOT CAUSATION"].every(label=>inline.includes(label)), "Historical events no longer separate fact, significance, gameplay effect and independent market context");
assert(inline.includes("Immediate effect: move BTC") && inline.includes("Consequence: the month is recorded as a rescue") && inline.includes("function settlementRescueFeedback(") && inline.includes("Receivership kept the run alive"), "Settlement, rescue or receivership feedback has lost its immediate and lasting consequences");
assert(inline.includes("if(state.cash+1e-8>=due){finishMonthlySettlement(") && inline.includes("if(!pending||state.cash+1e-8<pending.due)return false"), "Queueing and finishing a settlement must use the same float tolerance, or cash short by a rounding sliver pauses the run and demands a rescue for a shortfall too small to write as money");
assert(inline.includes("Mining capacity lost to a fault") && inline.includes("The self-repair caused damage") && inline.includes("Part replacement complete"), "Repair and failure feedback no longer states the capacity effect or recovery state");
assert(inline.includes('class="run-verdict"') && inline.includes("Final assessment") && inline.includes("Financial resilience") && inline.includes("The defining lesson is"), "The end-of-run recap no longer provides an assessment, operating evidence and a lesson");
// A glossary is only useful where the confusion happens: it opens from any contextual-help
// disclosure, searches abbreviations as well as expansions, and hands off to Method for
// the formula behind each term.
const glossarySource = await readFile(new URL("src/data/glossary.js", root), "utf8");
const glossaryContext = { };
vm.runInNewContext(glossarySource.replace("const GLOSSARY", "var GLOSSARY") + "\nglobalThis.glossaryApi={GLOSSARY,glossaryEntries};", glossaryContext);
const glossaryApi = glossaryContext.glossaryApi;
const methodTargets = new Set([...methodChapterIds, ...[...methodSource.matchAll(/ id="(method-[a-z-]+)"/g)].map(match => match[1])]);
assert(glossaryApi.GLOSSARY.length >= 40, "The glossary no longer covers the canonical terminology");
for (const entry of glossaryApi.GLOSSARY) {
  assert(entry.term && entry.def && entry.anchor, `Glossary entry "${entry.term}" is missing its definition or Method destination`);
  assert(methodTargets.has(entry.anchor), `Glossary entry "${entry.term}" points at a Method target that does not exist: ${entry.anchor}`);
}
for (const [query, expected] of [["fpps", "FPPS"], ["full pay per share", "FPPS"], ["ppa", "PPA"], ["power purchase agreement", "PPA"], ["asic", "ASIC"], ["btc", "BTC"], ["hashrate", "Hash rate"], ["runway", "Cash runway"], ["sats", "Satoshi"]]) {
  const hits = glossaryApi.glossaryEntries(query).map(entry => entry.term);
  assert(hits.includes(expected), `Searching the glossary for "${query}" no longer finds ${expected}`);
}
assert(glossaryApi.glossaryEntries("").length === glossaryApi.GLOSSARY.length, "An empty glossary search should list every term");
assert(inline.includes("function glossaryModalHtml()") && inline.includes("${glossaryOpen?glossaryModalHtml():\"\"}") && inline.includes('else if(a==="glossary"){glossaryOpen=true'), "The glossary modal is missing or cannot be opened");
assert(inline.includes('data-action="glossary">Open the glossary'), "Contextual help no longer offers a route into the glossary");
assert(inline.includes("function filterGlossary(query)") && inline.includes('e.target.matches("[data-glossary-search]")'), "Glossary search is not wired to the search field");
assert(inline.includes('else if(a==="glossary-method")') && inline.includes("data-action=\"glossary-method\""), "A glossary entry can no longer hand off to its Method chapter");
assert(css.includes(".glossary-entry .action-link{display:inline-flex;align-items:center;min-height:34px}") && css.includes(".glossary-entry .action-link{min-height:40px}"), "The Method link inside a glossary entry is an 11px text link without these rules — unusable on touch");

// Language audit. "Hashrate" is the product name and "hash rate" is the measurement;
// "/mo" is an unexplained abbreviation on a recurring cost; a temperature takes a space
// before its unit; and "liquidity" is the market-depth word, not the cash word. Each is
// easy to reintroduce by copying a nearby line, so they are checked rather than trusted.
const copyFiles = [];
async function collectCopyFiles(dir) {
  for (const entry of await readdir(new URL(dir, root), { withFileTypes: true })) {
    if (entry.isDirectory()) await collectCopyFiles(`${dir}${entry.name}/`);
    else if (entry.name.endsWith(".js")) copyFiles.push(`${dir}${entry.name}`);
  }
}
await collectCopyFiles("src/");
// A save key is an identifier, an export filename is a filename, and a shipped release
// note records what was written at the time. None of them are player-facing prose.
const LEGACY_EXEMPT = ['"hashrate-save.json"', '"hashrate-career-v1"', '"hashrate-genesis-save-v1"', "not a valid Hashrate save."];
const legacyHits = [];
for (const file of copyFiles) {
  const source = await readFile(new URL(file, root), "utf8");
  const exempt = LEGACY_EXEMPT.flatMap(text => {
    const at = source.indexOf(text);
    return at < 0 ? [] : [[at, at + text.length]];
  });
  if (file.endsWith("data/content.js")) {
    const start = source.indexOf("const CHANGELOG=[");
    exempt.push([start, source.indexOf("\n];", start)]);
  }
  if (file.endsWith("data/glossary.js")) exempt.push([0, source.length]);
  const covered = index => exempt.some(([from, to]) => index >= from && index < to);
  for (const match of source.matchAll(/[Hh]ashrate/g)) {
    if (!covered(match.index)) legacyHits.push(`${file}: "hashrate" should be "hash rate" (…${source.slice(Math.max(0, match.index - 30), match.index + 25).replace(/\s+/g, " ")}…)`);
  }
  for (const match of source.matchAll(/\/mo(?![a-z])/g)) {
    if (!covered(match.index)) legacyHits.push(`${file}: "/mo" should be "/month" (…${source.slice(Math.max(0, match.index - 30), match.index + 8).replace(/\s+/g, " ")}…)`);
  }
  for (const match of source.matchAll(/[^\s]°C/g)) {
    if (!covered(match.index)) legacyHits.push(`${file}: a temperature is glued to its unit; the rule is "22 °C" (…${source.slice(Math.max(0, match.index - 30), match.index + 6).replace(/\s+/g, " ")}…)`);
  }
  const CASH_MEANT = [
    [/label:"Liquidity"/, 'a card labelled "Liquidity" whose value is a cash runway — use "Cash runway"'],
    [/<th>Liquidity/, 'a table column headed "Liquidity" — say what it asks, e.g. "Can it pay a bill?"'],
    [/"Liquidity reserve/, '"Liquidity reserve" — the thing required is cash, so say "Cash reserve"'],
    [/default liquidity/, '"default liquidity" — the named control is Starting Liquidity'],
    [/(?:cooling|energy) and liquidity/i, 'a heading ending "and liquidity" where the subject is the operating bill'],
    [/missing liquidity/, '"the missing liquidity" — the thing received is cash'],
  ];
  for (const [pattern, explanation] of CASH_MEANT) {
    const match = pattern.exec(source);
    if (match && !covered(match.index)) legacyHits.push(`${file}: ${explanation}`);
  }

}
assert(legacyHits.length === 0, `Legacy terminology is back in player-facing copy:\n  ${legacyHits.slice(0, 8).join("\n  ")}`);

// Cooling plant is ordered and installed, not conjured. It was the only thing in the
// room that appeared instantly and was never drawn, so both are now checked.
const operationsSource = await readFile(new URL("src/data/operations.js", root), "utf8");
const coolingRows = [...operationsSource.matchAll(/\{id:"(\w+)",name:"([^"]+)",date:"[\d-]+",minTier:\d+,maxTier:\d+,cost:(\d+),install:(\d+),/g)];
assert(coolingRows.length === 7, `Every cooling item needs an install lead time; ${coolingRows.length} of 7 have one`);
let previousInstall = 0;
for (const [, id, name, cost, install] of coolingRows) {
  const days = Number(install);
  assert(days >= 1 && days <= 200, `${name} has an implausible install lead time of ${days} days`);
  assert(days >= previousInstall, `Cooling install times should not shrink as the plant gets bigger: ${name} takes ${days} days`);
  previousInstall = days;
}
assert(inline.includes("function coolingInstallDays(item)") && inline.includes("function advanceCoolingInstalls()") && inline.includes("advanceProcurement();advanceCoolingInstalls();"), "Cooling installs are not resolved on the simulation tick");
assert(inline.includes("state.thermal.orders.push({id,qty:1,due:state.time+days*DAY,cost:item.cost})") && !/state\.cash-=item\.cost;state\.thermal\.equipment\[id\]=/.test(inline), "Buying cooling must book an install rather than grant heat rejection immediately");
assert(inline.includes("thermal:{temperature:22,orders:[]") && inline.includes("state.thermal.orders=Array.isArray(state.thermal.orders)"), "Cooling orders are missing from the initial state or from the save migration");
assert(inline.includes("const projected=fleet(trial);if(projected.potentialKw>projected.cap)"), "The cooling headroom check must use peak draw: cooling is thermostatic, so a cold room draws almost nothing and a live-draw check passes however much plant is on order");
assert(inline.includes("function miningFloorCooling()") && inline.includes("${miningFloorCooling()}<div class=\"floor-units\""), "Installed cooling is not drawn on the live mining floor");
assert(inline.includes('<i class="cooling"></i> Cooling plant') && inline.includes('<i class="cooling-pending"></i> Cooling on order'), "The mining-floor legend does not explain the cooling sprites");
assert(css.includes(".floor-cooling-row{") && css.includes(".floor-cooling.pending{") && css.includes(".floor-cooling-row{top:58px;left:8px"), "Floor cooling sprites are missing their styling or their phone layout, where the facility caption spans the room and a right-aligned row collides with it");
assert(inline.includes('detail:"Cooling install"'), "A cooling install does not appear in the Dashboard build queue");
assert(inline.includes("${installDays}-day install") && inline.includes(">Order · ${fmtCompactUsd(item.cost)}</button>"), "The cooling card does not preview its install delay before the player commits");

// Two hashboard tiers look identical in a shop list, and buying the wrong one wastes
// both the money and the lead time. Which machines a part fits is derived from the
// same fault-weight table the engine repairs against, so the two cannot disagree.
assert(inline.includes("function hardwareUsingPart(partId)") && inline.includes("Object.keys(partFaultWeights(h)).includes(partId)"), "Part compatibility must be derived from partFaultWeights, not from a second hand-maintained list");
assert(inline.includes("function partFitSummary(partId)") && inline.includes('<div class="part-fit ${fit.fits?"":"unused"}">'), "The spare-part card does not say which machines the part fits");
assert(inline.includes("Nothing in your fleet uses this") && inline.includes("const spares=SPARE_PARTS.map(part=>{const fit=partFitSummary(part.id)"), "A part no machine in the fleet uses must say so rather than looking like a valid purchase");
assert(css.includes(".part-fit{") && css.includes(".part-fit.unused{"), "Part-fit lines are missing their styling");

// Five treasury policies were really two. Measured over an identical seeded run,
// "Cover the bill" and "HODL everything" were byte-identical whenever the operation
// stayed solvent, and the fixed-ratio policies traded BTC for a fraction of its value
// in cash. The screen now carries the one decision that exists.
const policyContext = {};
vm.runInNewContext(timelineSource.replace("const TREASURY_POLICIES", "var TREASURY_POLICIES") + "\nglobalThis.policies=TREASURY_POLICIES;", policyContext);
const policies = policyContext.policies;
assert(policies.length === 2, `Settlement conversion is one decision with two sides, not ${policies.length} options`);
assert(policies[0].id === "cover" && policies[1].id === "hodl", "The two settlement-conversion instructions should be cover and hold");
assert(policies.every(p => p.consequence && p.consequence.length > 40), "Each instruction must state its consequence, not just its name");
assert(!policies.some(p => "ratio" in p), "The fixed-ratio policies are gone; nothing should still carry a ratio");
assert(inline.includes('if(policy.id!=="cover")return 0;'), "Holding must sell nothing at settlement");
assert(!/sell25|sell50|sell100/.test(inline.replace(/const CHANGELOG=[\s\S]*?\n\];/, "")), "A removed treasury policy is still referenced outside the changelog");
assert(inline.includes("state.treasuryPolicy=TREASURY_POLICIES.some(x=>x.id===state.treasuryPolicy)?state.treasuryPolicy:\"cover\""), "A save holding a removed policy must fall back to covering the bill");
assert(inline.includes("Settlement conversion") && !inline.includes('<h2>Treasury policy</h2>'), "The panel should be named for the decision it carries");
assert(inline.includes('log("Settlement conversion changed"') && inline.includes("log(`Settlement conversion: ${policy.name}`"), "Ledger entries still call this a treasury policy");
assert(inline.includes("Next automatic sale") && inline.includes("Forecast shortfall"), "The panel no longer shows what the current instruction will actually do at the next settlement");

// A home-built tower takes standard case fans; only the laptop takes a laptop fan.
// The mapping lives on the machine so a new entry declares its own part.
const hardwareSource2 = await readFile(new URL("src/data/hardware.js", root), "utf8");
const fanContext = { };
vm.runInNewContext(timelineSource + "\n" + hardwareSource2.replace(/^const /gm, "var ") + "\nglobalThis.fanApi={HARDWARE,fanTierFor,hashboardTierFor};", fanContext);
const fanApi = fanContext.fanApi;
const fanFor = id => fanApi.fanTierFor(fanApi.HARDWARE.find(h => h.id === id));
assert(fanFor("laptop") === "laptopfan", "The mining laptop should take a laptop cooling fan");
assert(fanFor("cpu") === "fan", "A home-built quad-core tower takes 120mm case fans, not a laptop's internal fan");
assert(fanFor("5870") === "fan" && fanFor("fpga") === "fan", "GPU and FPGA hardware takes case fans");
assert(fanFor("s9") === "asicfan" && fanFor("s21hydro") === "asicfan", "ASIC and hydro ASIC hardware takes blower fans");
assert(fanApi.HARDWARE.filter(h => fanApi.fanTierFor(h) === "laptopfan").length === 1, "Only the laptop should take a laptop fan");
// simulation.js migrates saves against these at load time, so they must already exist.
const hardwareIdx = appScripts.indexOf("src/data/hardware.js"), simIdx = appScripts.indexOf("src/engine/simulation.js");
assert(hardwareIdx >= 0 && simIdx > hardwareIdx, "fanTierFor lives in hardware.js and simulation.js calls it in a top-level save migration; hardware.js must load first or the whole engine aborts");
assert(!/function fanTierFor|function hashboardTierFor/.test(await readFile(new URL("src/engine/maintenance.js", root), "utf8")), "The part-tier functions moved to hardware.js; a second copy in maintenance.js would shadow or contradict them");
assert(inline.includes('HARDWARE.filter(h=>fanTierFor(h)!=="laptopfan").forEach(h=>{const byPart=state.maintenance.faultsByPart?.[h.id];if(byPart&&byPart.laptopfan)'), "An existing tower fault recorded against the laptop fan is not migrated to the case fan");
assert(inline.includes('if(h&&job.part==="laptopfan"&&fanTierFor(h)!=="laptopfan")job.part=fanTierFor(h)'), "An in-flight repair recorded against the laptop fan is not migrated");

assert(!inline.includes("indexed to 100 at game start") && !inline.includes("<span>Game start</span>"), "The market chart said it was indexed at game start three times over; the card meta says it once");
assert(inline.includes('<div class="chart-labels end"><span id="dashboard-chart-date">') && css.includes(".chart-labels.end{justify-content:flex-end}"), "With one label left, the chart date must stay anchored to the right edge it marks");

// Bitcoin changes difficulty once every 2016 blocks and nowhere else. Storing one exact
// value per retarget is smaller than resampling it weekly and is the actual truth: the
// previous series held 920 points, of which 919 were values that never existed.
const bundle = await readFile(new URL("historical-data.js", root), "utf8");
const bundleContext = { window: {} };
vm.runInNewContext(bundle, bundleContext);
const recorded = bundleContext.window.HISTORICAL_DATA;
assert(recorded && recorded.PRICE && recorded.DIFFICULTY, "The historical bundle did not define window.HISTORICAL_DATA");
// The game's cutoff and the data's last day have to be the same day. If they drift, the
// sandbox either starts before the recorded feed runs out or leaves recorded days unplayed.
assert(recorded.meta.through === new Date(subsidy.END).toISOString().slice(0, 10), `The historical cutoff is ${new Date(subsidy.END).toISOString().slice(0, 10)} but the data runs to ${recorded.meta.through}`);
assert(sandboxContext.SANDBOX_END - subsidy.END === Math.round(365.25 * 100 * 86_400_000), "The sandbox horizon should stay exactly a hundred years past the cutoff");
assert(recorded.DIFFICULTY.length >= 400 && recorded.DIFFICULTY.length <= 700, `Difficulty should be one point per retarget, not ${recorded.DIFFICULTY.length}`);
assert(recorded.DIFFICULTY.length < recorded.HASH.length, "The difficulty series should be sparser than the hash series: it is a step function, not a sample");
assert(recorded.DIFFICULTY[0][1] === 1, "Difficulty must start at 1, the genesis epoch");
assert(recorded.DIFFICULTY.every((entry, i) => i === 0 || entry[1] !== recorded.DIFFICULTY[i - 1][1]), "A resampled difficulty series would repeat values between retargets");
assert(/mempool\.space/.test(recorded.meta.source) && recorded.meta.difficultySourceUrl, "The difficulty source is not attributed in the bundle metadata");
assert(!inline.includes("reconstructed daily mean") && !inline.includes("Difficulty is reconstructed from recorded hash rate"), "Difficulty is recorded now, not reconstructed; the copy must not still claim otherwise");
assert(inline.includes("holds until the next retarget"), "The difficulty readout should say the value holds until the next retarget rather than drifting daily");
assert(buildSource.includes("mempool.space/api/v1/mining/difficulty-adjustments") && buildSource.includes("--difficulty-only"), "The build script must fetch exact retargets, and must keep a mode that rewrites difficulty alone so an accuracy fix cannot pull unrelated revisions into every other series");
assert(/value \/ previous > 4\.000001/.test(buildSource), "The build must reject any difficulty step outside the protocol's 4x clamp rather than trusting the feed");

// Storage format: a regular series carries its start and cadence instead of repeating
// an ISO date beside every number, which was half the bundle. The file decodes itself,
// so everything downstream still sees the pair arrays it always did.
assert(/^\(function\(\)\{/m.test(bundle) && bundle.includes("window.HISTORICAL_DATA=data;"), "The bundle must decode itself and expose the same window.HISTORICAL_DATA shape");
assert(bundle.includes('"start"') && bundle.includes('"step"'), "The bundle is no longer storing regular series as start plus cadence");
assert(recorded.PRICE.every(entry => Array.isArray(entry) && typeof entry[0] === "string" && Number.isFinite(entry[1])), "Decoded series must be [date, value] pairs");
for (const key of ["PRICE", "HASH", "DIFFICULTY", "FEES", "TX", "HEIGHT"]) {
  const dates = recorded[key].map(entry => entry[0]);
  assert(dates.every((date, i) => i === 0 || date > dates[i - 1]), `${key} decodes out of date order`);
  assert(new Set(dates).size === dates.length, `${key} decodes with a duplicated date`);
}
assert(bundle.length < 500_000, `The bundle is ${Math.round(bundle.length / 1024)} KB; daily resolution should cost about 375 KB in this encoding, so anything much larger means the dates crept back`);
const dailyCadence = ["PRICE", "HASH", "FEES", "TX", "HEIGHT"];
for (const key of dailyCadence) {
  const gaps = recorded[key].slice(1).map((entry, i) => Math.round((Date.parse(entry[0]) - Date.parse(recorded[key][i][0])) / 86_400_000));
  const median = gaps.slice().sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
  assert(median === 1, `${key} should be recorded daily; its median gap is ${median} days`);
  assert(recorded[key].length > 5_000, `${key} has only ${recorded[key].length} points for seventeen years of daily data`);
}
assert(recorded.DIFFICULTY.length < 700, "Difficulty is a step function and must not be resampled daily along with the rest");
assert(!buildSource.includes("elapsed % 7 === 0"), "A weekly sampling step is back in the build");
assert(buildSource.includes("function encodeSeries(pairs)") && buildSource.includes("--recompress"), "The build must own the encoding, and keep a network-free mode that re-encodes the existing bundle");

// state.debt had a whole disconnection mechanic built around it — a banner, an Operator
// briefing, offline node reasons, a blocked mining floor — and nothing in the game ever
// set it above zero. Missing a bill was not a thing that could happen. Guard the middle
// path so it cannot go dead again.
assert(/state\.debt\s*\+=\s*carried/.test(inline), "Nothing raises arrears; a missed bill must actually be carried into state.debt");
assert(inline.includes("function deferSettlement()") && inline.includes('else if(a==="settle-defer")deferSettlement();'), "The miss-the-bill route is missing or unwired");
assert(inline.includes("function gridCutOff(s=state)") && inline.includes("s.debt>0&&s.time>=(s.arrearsDue||Infinity)"), "The grace period is gone: arrears must not cut the grid until the next bill date");
assert(inline.includes("state.arrearsDue=nextBillDate()"), "A missed bill must set the date the grid is cut if it stays unpaid");
// Owing money and being cut off are different states, and only the second stops the site.
for (const gate of ["function operating(){const fs=fleet();return state.power&&!gridCutOff()",
  "function nodeHostPowered(){if(gridCutOff()||state.policyLock)return false;",
  "function thermalPowerAvailable(s=state){return !!s.power&&!gridCutOff(s)&&"]) {
  assert(inline.includes(gate), `An operational gate still cuts the site the moment arrears exist, which removes the grace month: ${gate.slice(0, 48)}`);
}
assert(!/operating\(\)\{const fs=fleet\(\);return state\.power&&state\.debt<=0/.test(inline), "operating() is back to cutting the site on any arrears");
assert(inline.includes('id:"grid-arrears-grace"') && inline.includes('id:"grid-arrears"'), "The briefing must tell a warning apart from a disconnection");
assert(inline.includes('gridCutOff()?"Grid disconnected":"Operating bill in arrears"'), "The banner reads the same whether the grid is on or off");
assert(inline.includes("state.debt=0;state.arrearsDue=0;state.gridCutAnnounced=false;"), "Clearing arrears must also clear the cut-off date, or the site stays disconnected after paying");
assert(inline.includes("state.arrearsDue=Number(state.arrearsDue)||0") && inline.includes("if(state.debt<=0){state.arrearsDue=0;state.gridCutAnnounced=false}"), "Old saves must load with a coherent arrears state");
assert(inline.includes('showToast("Power and internet cut off"'), "The disconnection has to announce itself; it was silent before");

// A run under Cover the bill can sit at $0.00 cash for months while the treasury quietly
// sells BTC to keep the lights on. That is the policy working, but with only a Ledger
// line it was indistinguishable from a stuck game.
assert(inline.includes('showToast(heavy?"Treasury nearly emptied to pay the bill":"Bill covered by selling BTC"'), "Selling BTC to cover a bill must say so, and escalate when it is eating the last of the treasury");
assert(inline.includes("const left=controlled(),drained=btc/Math.max(btc+left,1e-12)") && inline.includes("const heavy=left<=0||drained>=.5"), "The treasury notice does not distinguish a routine conversion from one that empties the wallet");
assert(inline.includes("function treasurySaleForSettlement(due,silent=false)") && inline.includes("treasurySaleForSettlement(due,silent)") && inline.includes("queueMonthlySettlement(due,month,loanInterest,silent)"), "Settlement notices must respect silent ticks, or a catch-up after the tab was hidden fires a month of toasts at once");
assert(inline.includes('if(!silent)showToast("Settlement paused"'), "The settlement-paused toast still fires on silent catch-up ticks");
// The forecast drives the whole cash-runway story, and miners keep running through arrears.
assert(inline.includes("const minerWatts=state.power&&!gridCutOff()&&!state.policyLock?fs.w*contractLoadFactor():0"), "The settlement forecast assumes miners are off the moment arrears exist, understating the bill for the entire grace month");

// The old thermal model compared heat to a capacity number and added a flat penalty per
// unit of overload. Nothing in it conserved energy, so it had no gradient below capacity
// and ran away above it: a single 1.32 kW machine in a spare room reached 61 °C while a
// fully loaded campus barely moved. A room sheds heat in proportion to how much hotter it
// is than outside, and settles where heat in equals heat out.
const thermalSource = await readFile(new URL("src/engine/thermal.js", root), "utf8");
assert(thermalSource.includes("function thermalLossKwPerC(s=state)") && thermalSource.includes("coolingCapacityKw(s)/THERMAL_REFERENCE_DELTA"), "Cooling must express itself as heat shed per degree, not as a capacity to be exceeded");
assert(thermalSource.includes("ambientTemperatureC(s.time,s)+heatKw/thermalLossKwPerC(s)"), "The room temperature is no longer a heat balance");
assert(!/overload\*18|utilisation\*3\.2/.test(thermalSource), "The old overload cliff is back");
assert(thermalSource.includes("function siteBaselineC(s=state)") && thermalSource.includes("f.indoorBaseC??-Infinity"), "Enclosed sites need a temperature floor, or realistic winter ambients put a home office below freezing");
const opsSource = await readFile(new URL("src/data/operations.js", root), "utf8");
assert(/id:"home",[^}]*indoorBaseC:18/.test(opsSource), "A spare room sits inside a heated house");
assert(!/id:"container",[^}]*indoorBaseC/.test(opsSource), "A container yard is outdoors and should track the weather");
// Seasons peak about a month after the solstice.
assert(thermalSource.includes("Math.sin((day-111)/365*Math.PI*2)"), "The seasonal curve peaks on the solstice rather than a month after it");
const climates = [...opsSource.matchAll(/id:"(\w+)",name:"([^"]+)"[^}]*ambientC:(-?[\d.]+),seasonalC:(-?[\d.]+)/g)];
assert(climates.length === 8, `Expected eight regional climates, found ${climates.length}`);
for (const [, id, name, mean, swing] of climates) {
  const july = Number(mean) + Number(swing) * Math.sin((196 - 111) / 365 * 2 * Math.PI);
  const january = Number(mean) + Number(swing) * Math.sin((15 - 111) / 365 * 2 * Math.PI);
  assert(july < 34 && july > 8, `${name} has an implausible July mean of ${july.toFixed(1)} °C`);
  assert(january > -20 && january < 20, `${name} has an implausible January mean of ${january.toFixed(1)} °C`);
  assert(july > january, `${name} is warmer in January than July`);
}
assert(inline.includes("sheds ${fmtNum(thermalLossKwPerC())} kW per °C"), "The heat-rejection tile does not say what its capacity figure means");

// Required help patterns. The map's existence was already checked; what was not checked is
// whether the help it holds is usable — three terms per page, each actually defined, each
// pointing somewhere real, and no abbreviation left for the player to guess at.
const helpStart = renderSource.indexOf("const PAGE_HELP={");
const helpBlock = renderSource.slice(helpStart, renderSource.indexOf("\n};", helpStart));
assert(helpStart >= 0 && helpBlock.length > 0, "PAGE_HELP could not be extracted");
const helpEntries = [...helpBlock.matchAll(/(\w+):\{anchor:"([^"]+)",label:"([^"]+)",terms:\[(.*?)\]\}/g)].map(match => ({
  tab: match[1], anchor: match[2], label: match[3],
  terms: [...match[4].matchAll(/\["([^"]+)","([^"]+)"\]/g)].map(term => ({ name: term[1], definition: term[2] })),
}));
assert(helpEntries.length === orientationTabs.length, `Every non-Dashboard tab needs contextual help; found ${helpEntries.length} of ${orientationTabs.length}`);
for (const entry of helpEntries) {
  assert(entry.terms.length === 3, `${entry.tab} help defines ${entry.terms.length} terms; the disclosure is built for three`);
  assert(methodTargets.has(entry.anchor), `${entry.tab} help points at a Method target that does not exist: ${entry.anchor}`);
  assert(entry.label && entry.label === entry.label.toLowerCase(), `${entry.tab}'s help label reads mid-sentence as "How ${entry.label} works", so it should not be capitalised`);
  for (const term of entry.terms) {
    assert(term.definition.length >= 30, `${entry.tab} → "${term.name}" is defined in ${term.definition.length} characters; a definition explains a consequence, not a synonym`);
    assert(/[.!?]$/.test(term.definition), `${entry.tab} → "${term.name}" is not a finished sentence`);
    assert(!new RegExp(`^${term.name}\\b`, "i").test(term.definition), `${entry.tab} → "${term.name}" is defined by restating itself`);
    // An abbreviation on a card the player is reading has to be findable in the glossary.
    for (const abbreviation of term.name.match(/\b[A-Z]{2,}(?:\/[A-Z]+)?\b|\b[A-Z]\/[A-Z]{2}\b/g) || []) {
      assert(glossaryApi.glossaryEntries(abbreviation).length > 0, `"${abbreviation}" appears in ${entry.tab}'s help but cannot be found in the glossary`);
    }
  }
}
// The glossary is the fallback when a term is not on the page you are looking at, so the
// concepts help leans on should be searchable too.
for (const concept of ["hash rate", "power draw", "J/TH", "all-in rate", "reward variance", "knowledge", "bid", "cash runway", "liquid cash"]) {
  assert(glossaryApi.glossaryEntries(concept).length > 0, `The glossary cannot find "${concept}", which contextual help relies on`);
}

// The sandbox used to project a smooth trend with a ±15% sine and a flat monthly wobble.
// Its cycle and its volatility are now measured from the recorded history the run has just
// replayed: the shape is the detrended log residual of the three complete halving epochs,
// averaged by phase, and the volatility continues the decay from 139% annualised in
// 2011-13 to 46% in 2023-26.
const historyModel = await readFile(new URL("src/engine/history.js", root), "utf8");
assert(historyModel.includes("const HALVING_CYCLE_SHAPE=["), "The empirical halving-cycle shape is gone");
const shape = historyModel.match(/const HALVING_CYCLE_SHAPE=\[([^\]]+)\]/)[1].split(",").map(Number);
assert(shape.every(Number.isFinite), "The cycle template contains a value that is not a number");
assert(shape.length === 12, `The cycle template should carry twelve phase bins, not ${shape.length}`);
const trough = shape.indexOf(Math.min(...shape)), peak = shape.indexOf(Math.max(...shape));
assert(trough === 0, "The recorded cycle troughs immediately after a halving; the template no longer does");
assert(peak >= 3 && peak <= 5, `The recorded cycle peaks about a third of the way through an epoch; this template peaks at bin ${peak}`);
assert(Math.max(...shape) - Math.min(...shape) > 1.5, "The cycle template has been flattened back toward the sine it replaced");
assert(/CYCLE_AMP0=\.\d+,CYCLE_HALFLIFE=\d+/.test(historyModel), "The cycle amplitude no longer decays as the asset matures");
assert(/VOL_ANNUAL_0=\.\d+,VOL_ANNUAL_INF=\.\d+,VOL_HALFLIFE=\d+/.test(historyModel), "Projected volatility is no longer calibrated to the recorded series");
assert(!/cycleAmp=\.15\*Math\.exp|Math\.sin\(\(phase-\.2\)/.test(historyModel), "The old ±15% sine is back");
assert(historyModel.includes("function futureWobble(t,years,seed)") && !/futureWobble[^}]*nextRand/.test(historyModel), "The projected wobble must stay a pure function of the date, never the gameplay PRNG");
assert(historyModel.includes("cycleShapeAt(halvingPhase(t)-lag)"), "Hash rate should follow the price cycle with a lag rather than lead it: capacity is ordered after a rally and lands months later");

// A toast could not be dismissed. Clicking a linked one navigated but left it on screen for
// the full 8.5 seconds; an unlinked one was inert. Fixed over the bottom-right corner at
// z-index 70, that is what "sticky" felt like.
assert(inline.includes("function dismissToast()") && inline.includes('clearTimeout(toastTimer);toastTimer=null;toast=null;document.querySelector(".toast")?.remove()'), "A toast must be dismissible, and dismissing it has to clear the timer and the variable as well as the node");
assert(inline.includes('<button class="toast-dismiss" data-action="dismiss-toast" aria-label="Dismiss this message"'), "Every toast needs a labelled close control; an unlinked one had no way to go away at all");
assert(inline.includes('if(b.closest(".toast")){dismissToast();if(a==="dismiss-toast")return}'), "Acting on a toast must dismiss it, and must do so before the action re-renders — render() re-emits whatever `toast` still holds");
assert(!/fromToast[\s\S]{0,40}setTimeout\(dismissToast/.test(inline), "Dismissal must not be deferred to a timer: a background tab throttles those to about a second, which is the delay this fixed");
assert(inline.includes(':`data-action="dismiss-toast"`}'), "A toast with no destination should still be clickable to dismiss");
assert(css.includes(".toast-dismiss{") && css.includes("width:34px;height:34px") && css.includes(".toast-dismiss{width:40px;height:40px}"), "The toast close control is missing its styling or its touch targets");
assert(css.includes(".toast{padding-right:38px}"), "The close control overlaps the toast copy without room reserved for it");

// render() replaces #app entirely, which detaches every control inside it. If that lands
// between a press and its release the browser generates no click at all — the element the
// press began on no longer exists — and the press is silently swallowed. That is what
// "sometimes I cannot change speed or switch tabs" was.
assert(inline.includes("function holdRendersDuringPress()") && inline.includes("holdRendersDuringPress();"), "Repaints are no longer held during a press, so a repaint can swallow a click again");
assert(inline.includes("function deferWhilePressed(repaint)") && inline.includes("if(deferWhilePressed(()=>render(preserveScroll)))return;"), "render() must defer while a pointer is down");
assert(inline.includes("function renderMineContent(){\n  if(deferWhilePressed(renderMineContent))return;"), "renderMineContent() falls through to a full render on every tab but Mine, so it needs the same guard");
// The flush has to happen after the click is dispatched, never between release and click.
assert(inline.includes('document.addEventListener("click",()=>{pointerHeld=false;runDeferredRender()},false)'), "The held repaint must flush on click, in the bubble phase, after the action has run");
assert(!/pointerup[\s\S]{0,80}setTimeout\([\s\S]{0,40}runDeferredRender/.test(inline), "Flushing from a timer scheduled on pointerup can land between release and click and destroy the target again");
// A press that never reports a release must not freeze the interface.
assert(/setInterval\(\(\)=>\{if\(deferredRender/.test(inline) && inline.includes("performance.now()-deferredSince>1500"), "A stuck press would hold repaints forever without a sweeper");
assert(inline.includes('window.addEventListener("blur",()=>{pointerHeld=false;runDeferredRender()})'), "Losing focus mid-press must release the hold");

// Changing speed rebuilt the whole application to toggle one class, so the button was
// destroyed and recreated under the player's finger on every click — no active state, no
// focus, and any press overlapping the rebuild was lost. Four things depend on the speed;
// patch those and leave the rest of the DOM alone.
assert(inline.includes('else if(a==="speed"){state.speed=Number(v);state.returnSpeed=state.speed||state.returnSpeed;setTimer();save();refreshSpeedControls();refreshLive()}'), "Changing speed must patch its own controls, not rebuild the page underneath them");
assert(inline.includes("function refreshSpeedControls()"), "The speed-control patcher is missing");
assert(inline.includes('document.querySelectorAll(\'button.speed[data-action="speed"]\').forEach') && inline.includes('button.classList.toggle("active",Number(button.dataset.value)===state.speed)'), "The speed buttons no longer track the active speed in place");
// Replacing the button's children under a finger detaches the press target just as surely
// as replacing the button, so the icon and label are patched by textContent.
assert(inline.includes('<span class="pause-icon" aria-hidden="true">') && inline.includes('<span class="pause-label">'), "The mobile pause button needs separately patchable icon and label elements");
assert(inline.includes('if(icon)icon.textContent=state.speed?"Ⅱ":"▶"') && inline.includes('if(label)label.textContent=state.speed?"Pause":"Run"'), "The mobile pause button is being rebuilt rather than patched");
assert(!/\.mobile-pause-button[\s\S]{0,120}\.innerHTML=/.test(inline), "Setting innerHTML on the pause button detaches whatever the player is pressing");
assert(inline.includes("[data-live-simulation]") && inline.includes('label==="Simulation"?` data-live-simulation`:""'), "The Simulation metric has no hook, so it cannot be patched without a rebuild");
assert(inline.includes("[data-live-speed-panel]"), "The mobile speed panel has no hook");

// Every bad toast appended a full-screen fixed overlay and relied on animationend to take
// it away. Animations do not run in a background tab and may not run at all under reduced
// motion, so they accumulated: a 200-day fault storm left 82 stacked at z-index 9000, each
// compositing a full-viewport gradient every frame. That is what "locks up after a few
// toasts" was, and it grew without limit the longer a run went on.
assert(inline.includes("function clearImpactFlash()") && inline.includes('document.querySelectorAll(".impact-flash").forEach(node=>node.remove())'), "The impact flash must be swept up, including anything an earlier session leaked");
assert(inline.includes("flashTimer=setTimeout(clearImpactFlash,1200)"), "Removal cannot depend on animationend alone: it does not fire in a background tab");
const impactBody = inline.slice(inline.indexOf("function triggerImpactEffect()"), inline.indexOf("function triggerImpactEffect()") + 1200);
assert(impactBody.indexOf("clearImpactFlash();") >= 0 && impactBody.indexOf("clearImpactFlash();") < impactBody.indexOf('createElement("div")'), "Each impact must clear the previous overlay before adding its own, so only one can ever exist");
assert(inline.includes("function reducedMotion()") && /triggerImpactEffect\(\)\{\s*if\(reducedMotion\(\)\)return;/.test(inline), "A player who has asked for reduced motion should not be given a screen shake and a flash at all");
assert(inline.includes("shakeTimer=setTimeout(drop,900)"), "The shake class needs a timed removal too, or it can stay on .app forever — and a transform there changes the containing block for every fixed child");
assert(inline.includes("lastImpactAt=now") && inline.includes("now-lastImpactAt<4000"), "The shake throttle is gone");

// Every sprite used to embed the shared gradient defs: 830 bytes repeated 151 times on a
// busy Mine tab, and 750 duplicate element ids in one document. SVG resolves url(#mgm)
// against the first match, so the copies were already inert — they just cost 132KB.
assert(inline.includes("function svgSpriteDefs()") && inline.includes('class="svg-sprite-defs"'), "The shared sprite defs must be emitted once per page");
assert(inline.includes('document.getElementById("app").innerHTML=`${svgSpriteDefs()}<div class="app">'), "The defs block has to sit at the app root so it survives both a full render and a Mine-only repaint");
assert(!/(miner-icon|spare-part-icon|cooling-item-icon)[^`]*\$\{MINER_SVG_DEFS\}/.test(inline), "A sprite is carrying its own copy of the shared defs again");
assert((inline.match(/const MINER_SVG_DEFS=/g) || []).length === 1, "The shared defs should be defined exactly once");
const artIdx = appScripts.indexOf("src/ui/art.js"), consumerIdx = appScripts.indexOf("src/ui/enhance/mine-market.js");
assert(artIdx >= 0 && artIdx < consumerIdx, "art.js owns MINER_SVG_DEFS and must load before the sprite functions that reference it");
assert(css.includes(".svg-sprite-defs{position:absolute;width:0;height:0;overflow:hidden;pointer-events:none}"), "The defs carrier must take no layout space and no pointer events");

console.log("UI contracts passed: Mine purchases, difficulty and mobile speed controls, transaction precision, enhancement guards, mempool containment, fleet servicing, repair labour, overdrive, Method coverage, speed-resume safety, the exchange trade-ticket flow, network-hash display parity, bad-event impact effects, timed facility-upgrade risk, mining-floor connectivity/power status, the 100-year procedural sandbox continuation, pool fee display, pool shutdown fail-over, the custody transfer slider, Lightning gating, live market pricing, mempool realism, disabled-control tooltips, the single-venue market redesign, Mine-tab scroll stability, full-refurbishment puzzle consistency, the proactive settlement warning, connectivity ping, the unified incoming-fleet pipeline, proportional fleet-health severity colors, rival operators, milestone moments, the end-of-run recap, cross-run career persistence, the dice-entropy wallet-setup ceremony, the era-accurate wallet-software upgrade path, the resetGame() operator-era crash fix, the real mailing-list learning items, the Dashboard build-queue card, hands-on self-servicing before technicians are hired, the fault-clearing/offline-threshold repair fix, the non-blocking faucet popup, tiered spare parts, the historically-grounded custody/region exposure warnings, free self-serviced labour with real self-damage risk, the four hardware self-help skills, staff dismissal the operator XP/level system, dated pool payout schemes, one drawing per machine, and scroll-anchored, frame-aligned repaints");
