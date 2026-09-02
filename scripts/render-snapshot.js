"use strict";

/* RENDER SNAPSHOT — a structural fingerprint of every tab in a set of fixed game states.
   Load this in the running page and call `snapshotAll()`. It records the DOM skeleton —
   tag, sorted class list, data-action, disabled state, depth — for each tab under each
   fixture. It deliberately ignores text and numbers, so it is immune to live tick values
   and sensitive to exactly what a render refactor risks: elements going missing, being
   duplicated, being reordered, or losing their action wiring.

   Usage in the browser console (or via a driving tool):
     const before = snapshotAll();          // on the current build
     ... refactor ...
     const after  = snapshotAll();          // after reload
     snapshotDiff(before, after);           // [] when the DOM is structurally identical

   Determinism: verified stable across repeated captures. The only moving part is the
   dashboard mempool mosaic, which randomises its own cell classes every frame; those are
   normalised to a single token rather than excluded, so a change in cell COUNT still
   registers. */

function snapshotSignature(root) {
  const host = root || document.getElementById("app");
  const lines = [];
  const walk = (el, depth) => {
    const raw = typeof el.className === "string" ? el.className : (el.className && el.className.baseVal) || "";
    const cls = raw.trim().split(/\s+/).filter(Boolean).sort().join(".");
    const act = el.dataset && el.dataset.action
      ? `[${el.dataset.action}${el.dataset.value ? "=" + el.dataset.value : ""}]`
      : "";
    let line = `${depth}|${el.tagName}${cls ? "." + cls : ""}${act}${el.disabled ? ":disabled" : ""}`;
    if (line.includes("mp-cell")) line = line.replace(/\|SPAN\.[^[]*mp-cell[^[]*/, "|SPAN.mp-cell~");
    lines.push(line);
    for (const child of el.children) walk(child, depth + 1);
  };
  walk(host, 0);
  return lines;
}

/* Four states chosen to exercise different shapes of the interface: an empty early game, a
   mid-game fleet carrying faults, a large site in arrears with cooling on order, and a rich
   endgame at the cutoff. Between them they light up every conditional branch worth guarding. */
function snapshotFixtures() {
  const blankMaintenance = () => ({
    condition: {}, faults: {}, faultsByPart: {}, selfRepairs: {}, parts: 0,
    inventory: state.maintenance.inventory, orders: [], serviceJobs: [],
  });
  return [
    {
      name: "early-2010-home-laptop",
      apply() {
        state.time = at("2010-03-01"); state.facility = "home"; state.hardware = { laptop: 1 };
        state.cash = 1800; state.wallets = { hot: 12, cold: 3 }; state.mode = "solo";
        state.thermal = { temperature: 20, orders: [], equipment: {} };
        state.maintenance = blankMaintenance(); state.debt = 0; state.power = true;
      },
    },
    {
      name: "2017-warehouse-faults",
      apply() {
        state.time = at("2017-06-01"); state.facility = "warehouse"; state.hardware = { s9: 120 };
        state.cash = 250000; state.wallets = { hot: 4, cold: 2 }; state.mode = "pool"; state.pool = "slush";
        state.thermal = { temperature: 26, orders: [], equipment: { ahu: 1 } };
        state.maintenance = Object.assign(blankMaintenance(), {
          condition: { s9: 72 }, faults: { s9: 9 }, faultsByPart: { s9: { hashboard: 6, powerPcb: 3 } },
        });
        state.debt = 0; state.power = true;
      },
    },
    {
      name: "2021-campus-arrears",
      apply() {
        state.time = at("2021-06-01"); state.facility = "campus"; state.hardware = { s19: 600 };
        state.cash = 0; state.wallets = { hot: 1, cold: 0 }; state.mode = "pool";
        state.thermal = { temperature: 30, equipment: { ahu: 2 },
          orders: [{ id: "evap", qty: 1, due: state.time + 20 * DAY, cost: 420000 }] };
        state.maintenance = Object.assign(blankMaintenance(), {
          condition: { s19: 80 }, faults: { s19: 30 }, faultsByPart: { s19: { hashboard: 30 } },
        });
        state.debt = 18000; state.arrearsDue = state.time + 10 * DAY; state.power = true;
      },
    },
    {
      name: "2026-cutoff-rich",
      apply() {
        state.time = END - DAY * 3; state.facility = "megacampus"; state.hardware = { s21xp: 2000 };
        state.cash = 9e6; state.wallets = { hot: 40, cold: 120 }; state.mode = "pool";
        state.thermal = { temperature: 24, orders: [], equipment: { coolingtower: 1 } };
        state.maintenance = Object.assign(blankMaintenance(), { condition: { s21xp: 90 } });
        state.debt = 0; state.power = true;
      },
    },
  ];
}

const SNAPSHOT_TABS = ["dashboard", "mine", "pools", "market", "custody", "facilities",
  "energy", "finance", "learn", "tech", "ledger", "method"];

function snapshotAll() {
  const saved = JSON.parse(JSON.stringify(state));
  const savedTab = activeTab;
  const captured = {};
  try {
    for (const fixture of snapshotFixtures()) {
      state.started = true; state.ended = false; state.endDismissed = true; state.activeEvent = null;
      state.walletSetup = { done: true }; state.speed = 0; state.policyLock = null;
      state.skills = []; state.staff = [];
      fixture.apply();
      for (const tab of SNAPSHOT_TABS) {
        activeTab = tab;
        render(false);
        captured[`${fixture.name}/${tab}`] = snapshotSignature();
      }
    }
  } finally {
    state = JSON.parse(JSON.stringify(saved));
    activeTab = savedTab;
    render(false);
  }
  return captured;
}

/* Reports the first structural divergence per snapshot rather than every line, because a
   single inserted element shifts everything after it and the tail is noise. */
function snapshotDiff(before, after) {
  const differences = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    const a = before[key], b = after[key];
    if (!a) { differences.push({ snapshot: key, change: "added" }); continue; }
    if (!b) { differences.push({ snapshot: key, change: "removed" }); continue; }
    if (a.join("\n") === b.join("\n")) continue;
    let index = 0;
    while (index < a.length && index < b.length && a[index] === b[index]) index += 1;
    differences.push({
      snapshot: key, change: "changed",
      nodesBefore: a.length, nodesAfter: b.length,
      firstDivergenceAt: index, before: a[index] || "(end)", after: b[index] || "(end)",
    });
  }
  return differences;
}

function snapshotHashes(captured) {
  const hash = text => {
    let h = 2166136261;
    for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  };
  const out = {};
  for (const key of Object.keys(captured)) out[key] = `${captured[key].length}:${hash(captured[key].join("\n"))}`;
  return out;
}
