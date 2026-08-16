import { readFile, stat } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const html = await readFile(new URL("index.html", root), "utf8");
const expectedScripts = [
  "historical-data.js",
  "src/config/timeline.js",
  "src/data/network.js",
  "src/data/hardware.js",
  "src/data/operations.js",
  "src/data/progression.js",
  "src/data/content.js",
  "src/engine/history.js",
  "src/engine/simulation.js",
  "src/engine/actions.js",
  "src/ui/presentation.js",
  "src/ui/tabs/dashboard.js",
  "src/ui/tabs/pools.js",
  "src/ui/tabs/mine.js",
  "src/ui/tabs/ledger.js",
  "src/ui/tabs/market.js",
  "src/ui/tabs/operations.js",
  "src/ui/tabs/method.js",
  "src/ui/enhance/mine-market.js",
  "src/ui/enhance/custody.js",
  "src/ui/enhance/operations.js",
  "src/ui/render.js",
  "src/app/events.js",
  "src/app/bootstrap.js",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(!/<style[\s>]/i.test(html), "index.html contains an inline stylesheet");
assert(!/<script(?!\s+src=)[^>]*>/i.test(html), "index.html contains inline application JavaScript");
assert(html.includes('<link rel="stylesheet" href="src/styles/app.css">'), "The external application stylesheet is not linked");

const actualScripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(match => match[1]);
assert(JSON.stringify(actualScripts) === JSON.stringify(expectedScripts), "Application scripts are missing or loaded out of dependency order");
assert(new Set(actualScripts).size === actualScripts.length, "A script is loaded more than once");

for (const file of ["src/styles/app.css", ...expectedScripts]) {
  const info = await stat(new URL(file, root));
  assert(info.isFile() && info.size > 0, `${file} is missing or empty`);
  if (file.startsWith("src/") && file.endsWith(".js")) assert(info.size < 70_000, `${file} has grown beyond the agreed module ceiling`);
}

assert((await stat(new URL("index.html", root))).size < 5_000, "index.html is becoming a monolith again");
console.log(`Project structure passed: ${expectedScripts.length - 1} application modules, one generated historical bundle, one stylesheet`);
