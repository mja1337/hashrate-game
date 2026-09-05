import { readFile, readdir, stat } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const html = await readFile(new URL("index.html", root), "utf8");
const expectedScripts = [
  "historical-data.js",
  "src/config/timeline.js",
  "src/data/network.js",
  "src/data/rivals.js",
  "src/data/hardware.js",
  "src/data/operations.js",
  "src/data/progression.js",
  "src/data/content.js",
  "src/data/custody.js",
  "src/data/glossary.js",
  "src/engine/history.js",
  "src/engine/thermal.js",
  "src/engine/nodes.js",
  "src/engine/operator.js",
  "src/engine/simulation.js",
  "src/engine/settlement.js",
  "src/engine/custody.js",
  "src/engine/maintenance.js",
  "src/engine/pools.js",
  "src/engine/actions.js",
  "src/engine/recap.js",
  "src/ui/notify.js",
  "src/ui/presentation.js",
  "src/ui/art.js",
  "src/ui/tabs/dashboard.js",
  "src/ui/tabs/pools.js",
  "src/ui/tabs/mine.js",
  "src/ui/tabs/ledger.js",
  "src/ui/tabs/market.js",
  "src/ui/tabs/operations.js",
  "src/ui/tabs/method-chapters.js",
  "src/ui/tabs/method.js",
  "src/ui/enhance/mine-market.js",
  "src/ui/enhance/keys.js",
  "src/ui/enhance/custody.js",
  "src/ui/enhance/operations.js",
  "src/ui/live.js",
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

/* The ceiling used to apply only to scripts listed in the manifest, so any module not yet
   wired into index.html escaped it entirely — which is exactly when a file is most likely to
   be growing unwatched. It now walks src/ and checks everything found there.

   vendor/ is deliberately outside that walk. The rule exists to force oversized FIRST-PARTY
   files to be split; splitting somebody else's library would only make it harder to replace,
   and its size is a decision taken once when it is vendored rather than something that
   creeps. */
{
  const walk = async dir => {
    const out = [];
    for (const entry of await readdir(new URL(dir + "/", root), { withFileTypes: true })) {
      if (entry.isDirectory()) out.push(...await walk(`${dir}/${entry.name}`));
      else if (entry.name.endsWith(".js")) out.push(`${dir}/${entry.name}`);
    }
    return out;
  };
  const modules = await walk("src");
  assert(modules.length >= expectedScripts.filter(f => f.startsWith("src/")).length,
    "The source walk found fewer modules than the manifest lists");
  for (const file of modules) {
    const info = await stat(new URL(file, root));
    assert(info.size < 70_000, `${file} has grown beyond the agreed module ceiling`);
  }
}

/* NO RUNTIME NETWORK CALLS. The game reads a bundled dataset and nothing else, Method says
   so in as many words, and it is the reason this works offline, from file:// and on a static
   host. Until now that was true by habit. A vendored third-party library is precisely how a
   promise like that stops being true without anyone deciding to break it — a version bump
   adds a loader, and nothing complains. */
{
  const shipped = [...await (async function walk(dir) {
    const out = [];
    for (const entry of await readdir(new URL(dir + "/", root), { withFileTypes: true })) {
      if (entry.isDirectory()) out.push(...await walk(`${dir}/${entry.name}`));
      else if (entry.name.endsWith(".js")) out.push(`${dir}/${entry.name}`);
    }
    return out;
  })("src"), "vendor/three.floor.js"];
  const banned = [
    [/(^|[^.\w])fetch\s*\(/, "fetch()"],
    [/XMLHttpRequest/, "XMLHttpRequest"],
    [/new\s+WebSocket/, "WebSocket"],
    [/new\s+EventSource/, "EventSource"],
    [/navigator\s*\.\s*sendBeacon/, "sendBeacon"],
    [/(^|[^.\w])import\s*\(/, "dynamic import()"],
    [/importScripts\s*\(/, "importScripts()"],
  ];
  /* Comments are stripped first. The header of the vendored library says in plain English
     that it contains no XMLHttpRequest, and the first version of this check dutifully failed
     on that sentence. A check for network calls has to read code, not prose about code. */
  const stripComments = text => text
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
  for (const file of shipped) {
    const text = stripComments(await readFile(new URL(file, root), "utf8"));
    for (const [pattern, what] of banned) {
      assert(!pattern.test(text),
        `${file} makes a runtime network call (${what}); the game loads a bundled dataset and nothing else`);
    }
  }
}

for (const file of ["src/styles/app.css", ...expectedScripts]) {
  const info = await stat(new URL(file, root));
  assert(info.isFile() && info.size > 0, `${file} is missing or empty`);
  if (file.startsWith("src/") && file.endsWith(".js")) assert(info.size < 70_000, `${file} has grown beyond the agreed module ceiling`);
}

assert((await stat(new URL("index.html", root))).size < 5_000, "index.html is becoming a monolith again");
console.log(`Project structure passed: ${expectedScripts.length - 1} application modules, one generated historical bundle, one stylesheet`);
