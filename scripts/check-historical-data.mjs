import { readFile } from "node:fs/promises";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const html = await readFile(new URL("index.html", root), "utf8");
const source = await readFile(new URL("historical-data.js", root), "utf8");

new vm.Script(source, { filename: "historical-data.js" });
for (const match of html.matchAll(/<script src="([^"]+\.js)"><\/script>/gi)) {
  if (match[1] === "historical-data.js") continue;
  const script = await readFile(new URL(match[1], root), "utf8");
  new vm.Script(script, { filename: match[1] });
}

const context = { window: {} };
vm.runInNewContext(source, context);
const data = context.window.HISTORICAL_DATA;
if (!data) throw new Error("HISTORICAL_DATA was not defined");

const requirements = {
  PRICE: 5_000,
  HASH: 800,
  DIFFICULTY: 800,
  FEES: 900,
  TX: 800,
  HEIGHT: 800,
};

for (const [name, minimum] of Object.entries(requirements)) {
  const series = data[name];
  if (!Array.isArray(series) || series.length < minimum) throw new Error(`${name} has only ${series?.length ?? 0} points`);
  let previous = -Infinity;
  for (const [date, value] of series) {
    const time = Date.parse(`${date}T00:00:00Z`);
    if (!Number.isFinite(time) || time <= previous) throw new Error(`${name} has an unordered or duplicate date at ${date}`);
    if (!Number.isFinite(value) || value < 0) throw new Error(`${name} has an invalid value at ${date}`);
    previous = time;
  }
  if (series.at(-1)[0] !== data.meta.through) throw new Error(`${name} ends at ${series.at(-1)[0]}, expected ${data.meta.through}`);
}

if (data.HEIGHT.some((entry, index) => index && entry[1] < data.HEIGHT[index - 1][1])) throw new Error("HEIGHT must be monotonic");
if (Math.max(...data.FEES.map(entry => entry[1])) <= 1) throw new Error("FEES did not retain high-fee periods");
if (new Set(data.DIFFICULTY.map(entry => entry[1])).size < 400) throw new Error("DIFFICULTY is unexpectedly coarse");
const dailyPriceStart = data.PRICE.findIndex(([date]) => date === "2010-07-17");
for (let index = dailyPriceStart + 1; index < data.PRICE.length; index++) {
  const previous = Date.parse(`${data.PRICE[index - 1][0]}T00:00:00Z`);
  const current = Date.parse(`${data.PRICE[index][0]}T00:00:00Z`);
  if (current - previous > 86_400_000) throw new Error(`PRICE lost daily coverage after market launch at ${data.PRICE[index][0]}`);
}

console.log("Historical data and application JavaScript syntax checks passed");
console.table(Object.fromEntries(Object.entries(requirements).map(([name]) => [name, {
  points: data[name].length,
  first: data[name][0][0],
  last: data[name].at(-1)[0],
}])));
