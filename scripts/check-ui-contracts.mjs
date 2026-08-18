import { readFile } from "node:fs/promises";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const html = await readFile(new URL("index.html", root), "utf8");
const css = await readFile(new URL("src/styles/app.css", root), "utf8");
const appScripts = [...html.matchAll(/<script src="(src\/[^"]+\.js)"><\/script>/g)].map(match => match[1]);
const inline = (await Promise.all(appScripts.map(file => readFile(new URL(file, root), "utf8")))).join("\n");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const modeStart = inline.indexOf("const STARTING_MODES=[");
const modeEnd = inline.indexOf("\n];", modeStart) + 3;
assert(modeStart >= 0 && modeEnd > modeStart, "STARTING_MODES could not be extracted");
const modeContext = {};
vm.runInNewContext(inline.slice(modeStart, modeEnd).replace("const STARTING_MODES", "var STARTING_MODES"), modeContext);
assert(JSON.stringify(modeContext.STARTING_MODES.map(({ id, start }) => [id, start])) === JSON.stringify([
  ["easy", 1233100800000],
  ["medium", 1233619200000],
  ["hard", 1288483200000],
]), "Campaign start-date options changed unexpectedly");

const helperNames = ["fmtUsd", "fmtBtc", "fmtCompactNumber", "fmtCompactUsd"];
const helperSource = inline.split(/\r?\n/).filter(line => helperNames.some(name => line.startsWith(`function ${name}(`))).join("\n");
const helperContext = { Intl, Number, Math };
vm.runInNewContext(helperSource, helperContext);
assert(helperContext.fmtUsd(Number.NaN) === "—", "Invalid USD values must not be displayed as zero");
assert(helperContext.fmtUsd(0.0004) === "$0.0004", "Tiny USD values lost precision");
assert(helperContext.fmtBtc(0.000000001) === "<0.00000001 BTC", "Sub-satoshi BTC values must not be displayed as zero");
assert(helperContext.fmtCompactUsd(0.004) !== "$0", "Compact USD formatting rounded a non-zero value to zero");

assert(!inline.includes("introLiquidity"), "Legacy arbitrary starting-liquidity state remains");
assert(!inline.includes("data-starting-liquidity"), "Legacy starting-liquidity inputs remain");
assert(inline.includes('data-action="starting-mode"'), "Difficulty controls are missing");
assert(inline.includes("Starting difficulty"), "Method is missing difficulty documentation");
assert(inline.includes("Transaction sizing and procurement"), "Method is missing transaction documentation");
assert(inline.includes('if(a==="starting-mode")'), "Difficulty action is not handled");
assert(inline.includes("transactionPreviewValid(preview)"), "Invalid transaction quotes are not blocked");
assert(inline.includes("revision===renderRevision&&activeTab===tab"), "Stale tab enhancers can still duplicate injected visuals");
assert(inline.includes('class="card span-12 exchange-balance-desk"'), "Market exchange-balance summary is missing");
assert(inline.includes('class="span-12 facility-grid facility-options"'), "Facilities choices do not have a stable ordering target");
assert(inline.includes('if(command&&facilityOptions)command.insertAdjacentElement("afterend",facilityOptions)'), "Facility choices are not placed directly below the current-facility command");
assert(inline.includes("Math.min(900,Math.max(240,Math.ceil(days/7)+1))"), "Historical charts are not using capped weekly-or-better sampling");
assert(inline.includes('"dashboard","mine","pools","market"'), "Pools is not a standalone navigation destination");
assert(inline.includes('if(activeTab==="pools")return pools()'), "Pools page is not routed");
assert(inline.includes('id:"bch"') && inline.includes('id:"bsv"'), "BCH and BSV fork-risk actions are missing");
assert(inline.includes("UX walkthrough · page flow") && inline.includes("UX walkthrough · operating loop"), "Startup UX walkthrough is incomplete");
assert(inline.includes('class="mobile-pause-button') && inline.includes('class="mobile-speed-panel"'), "Mobile simulation controls are missing");
assert(inline.includes('data-action="mobile-menu-section"') && inline.includes('mobileMenuSection="play"'), "Mobile navigation is not grouped into first-tap sections");
assert(css.includes('.mobile-menu-sections{display:grid;grid-template-columns:repeat(4') && css.includes('.mobile-nav-tabs{display:grid;grid-template-columns:repeat(4'), "Mobile secondary navigation is not condensed for small screens");
assert(css.includes("#dashboard-mempool{overflow:hidden}") && css.includes(".mp-chain{width:100%;flex:0 0 auto"), "Mobile mempool containment rules are missing");
assert(inline.includes('const tickerBtc=value=>fmtBtc(value).replace(/ BTC$/,'), "Ticker BTC values still include a redundant unit suffix");
assert(css.includes(".tick{min-width:115px;overflow:hidden") && css.includes("text-overflow:ellipsis"), "Ticker values can spill into adjacent cards");
assert(inline.includes("retired=state.decommissionedHardware?.[id]||0") && inline.includes("retired=state.decommissionedHardware?.[h.id]||0"), "Miner sale controls do not consistently use retired inventory");
assert(inline.includes("function facilityDeskSvg()") && inline.includes('floor-miner ${status} ${h.id==="laptop"?"laptop-desk":""}'), "Mining facilities no longer retain the laptop desk visual");
assert(css.includes('.tier-1 .floor-units,.tier-2 .floor-units{left:28px') && css.includes('.floor-miner.laptop-desk{position:absolute'), "Home-office miners are not arranged around the laptop desk and shelves");

const optionsStart = inline.indexOf("function hardwareFiatPurchaseOptions(");
const optionsEnd = inline.indexOf("\nfunction hardwareFiatBuyControls(", optionsStart);
assert(optionsStart >= 0 && optionsEnd > optionsStart, "Mine purchase-option helper could not be extracted");
const optionsContext = { Number, Math, Set };
vm.runInNewContext(inline.slice(optionsStart, optionsEnd), optionsContext);
for (const [maximum, expected] of [[0, [1]], [1, [1]], [2, [1, 2]], [5, [1, 5]], [6, [1, 5, 6]]]) {
  const actual = optionsContext.hardwareFiatPurchaseOptions(maximum).map(option => option.qty);
  assert(JSON.stringify(actual) === JSON.stringify(expected), `Mine purchase quantities are wrong for a maximum of ${maximum}`);
  assert(new Set(actual).size === actual.length, `Mine purchase quantities contain duplicates for a maximum of ${maximum}`);
}
const controlsStart = inline.indexOf("function hardwareFiatBuyControls(");
const controlsEnd = inline.indexOf("\nfunction mine(", controlsStart);
const controlsSource = inline.slice(controlsStart, controlsEnd);
assert((controlsSource.match(/data-action=\\?"buy-hw\\?"/g) || []).length === 1, "A Mine card can render more than one dollar-purchase button");
assert(controlsSource.includes("data-hardware-quantity"), "Mine batch quantities are not available through the single-button control");

assert(inline.includes('internet:25'), "Starter NA region internet bill is not reduced");
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
assert(inline.includes("VENUE_TICKET_STYLE") && css.includes(".exchange-ticket-quote") && css.includes(".ticket-side.buy"), "Exchange trade-ticket redesign is missing");
assert(inline.includes('set("live-network-hash",fmtHash(competitiveHashAt(state.time,fs.hash)))') && inline.includes("competitiveHashAt(state.time,fs.hash))}</div><div class=\"subvalue\">recorded + unseen-miner floor"), "Displayed network hash no longer matches the effective competitive figure used for mining odds");
assert(inline.includes("function triggerImpactEffect()") && inline.includes('showToast(title,message,kind="info")'), "Bad-event impact effect is not wired into showToast");
assert(css.includes(".impact-flash{") && css.includes(".impact-shake{") && css.includes(".toast.toast-bad{"), "Impact-flash/shake CSS is missing");
assert((inline.match(/,"bad"\)/g) || []).length >= 12, "Not enough bad-event call sites trigger the impact effect");
console.log("UI contracts passed: Mine purchases, difficulty and mobile speed controls, transaction precision, enhancement guards, mempool containment, fleet servicing, repair labour, overdrive, Method coverage, speed-resume safety, the exchange trade-ticket flow, network-hash display parity and bad-event impact effects");
