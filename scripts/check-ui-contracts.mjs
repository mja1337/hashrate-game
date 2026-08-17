import { readFile } from "node:fs/promises";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const html = await readFile(new URL("index.html", root), "utf8");
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
assert(inline.includes("Opening difficulty and starting capital"), "Method is missing difficulty documentation");
assert(inline.includes("Transaction sizing, quotes and precision"), "Method is missing transaction documentation");
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

console.log("UI contracts passed: unique Mine purchases, difficulty modes, transaction precision, enhancement guards and Method coverage");
