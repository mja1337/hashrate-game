import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = resolve(ROOT, "historical-data.js");
const START = "2009-01-03";
const END = "2026-08-08";
const DAY = 86_400_000;
const METRICS = ["PriceUSD", "HashRate", "FeeTotNtv", "BlkCnt", "TxCnt"];
const ENDPOINT = "https://community-api.coinmetrics.io/v4/timeseries/asset-metrics";

function day(date) {
  return Date.parse(`${date}T00:00:00Z`);
}

function dateOf(row) {
  return row.time.slice(0, 10);
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function significant(value, digits = 9) {
  return Number(value.toPrecision(digits));
}

async function fetchRows() {
  const query = new URLSearchParams({
    assets: "btc",
    metrics: METRICS.join(","),
    frequency: "1d",
    start_time: START,
    end_time: END,
    page_size: "10000",
  });
  let url = `${ENDPOINT}?${query}`;
  const rows = [];
  while (url) {
    const response = await fetch(url, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`Coin Metrics returned ${response.status}: ${await response.text()}`);
    const payload = await response.json();
    rows.push(...payload.data);
    url = payload.next_page_url || null;
  }
  return rows.sort((a, b) => day(dateOf(a)) - day(dateOf(b)));
}

function dailyPrice(rows) {
  const manualDiscovery = [
    ["2009-10-05", 0.00076],
    ["2010-02-06", 0.003],
    ["2010-05-22", 0.0043],
    ["2010-07-17", 0.08],
  ];
  const byDate = new Map(manualDiscovery);
  for (const row of rows) {
    const price = number(row.PriceUSD);
    if (price !== null && price > 0 && day(dateOf(row)) > day("2010-07-17")) {
      byDate.set(dateOf(row), significant(price, 10));
    }
  }
  return [...byDate].sort((a, b) => day(a[0]) - day(b[0]));
}

function rollingSeries(rows, windowDays, valueForWindow, cadenceDays = 7) {
  const valid = rows.filter(row => valueForWindow([row]) !== null);
  const result = [];
  for (let i = 0; i < valid.length; i++) {
    const current = valid[i];
    const cutoff = day(dateOf(current)) - (windowDays - 1) * DAY;
    let start = i;
    while (start > 0 && day(dateOf(valid[start - 1])) >= cutoff) start--;
    const value = valueForWindow(valid.slice(start, i + 1));
    if (value === null) continue;
    const elapsed = Math.round((day(dateOf(current)) - day(dateOf(valid[0]))) / DAY);
    if (result.length === 0 || elapsed % cadenceDays === 0 || i === valid.length - 1) {
      result.push([dateOf(current), significant(value, 9)]);
    }
  }
  return result;
}

function smoothedHash(rows) {
  return rollingSeries(rows, 14, window => {
    const values = window.map(row => number(row.HashRate)).filter(value => value !== null && value > 0);
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length * 1e12;
  });
}

const RETARGET_ENDPOINT = "https://mempool.space/api/v1/mining/difficulty-adjustments/all";

async function fetchRetargets() {
  const response = await fetch(RETARGET_ENDPOINT, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`mempool.space returned ${response.status}: ${await response.text()}`);
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length < 400) throw new Error("mempool.space returned too few difficulty adjustments");
  return rows.map(([timestamp, height, value]) => ({ timestamp, height, value })).sort((a, b) => a.timestamp - b.timestamp);
}

// Bitcoin's difficulty is a step function: one value per 2016-block epoch, held exactly
// until the next retarget. Storing one point per retarget is the whole truth, and the
// game reads it with stepAt() rather than interpolating between the steps.
function difficulty(retargets) {
  const cutoff = day(END);
  const points = [];
  let previous = null;
  for (const { timestamp, height, value } of retargets) {
    const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
    if (day(date) > cutoff) break;
    if (!Number.isFinite(value) || value <= 0) throw new Error(`Bad difficulty at height ${height}`);
    if (previous !== null && (value / previous > 4.000001 || value / previous < 0.2499)) {
      throw new Error(`Difficulty at height ${height} moves outside the protocol's 4x clamp`);
    }
    previous = value;
    if (points.length && points[points.length - 1][0] === date) points[points.length - 1][1] = significant(value, 9);
    else points.push([date, significant(value, 9)]);
  }
  return points;
}

function smoothedFees(rows) {
  const valid = rows.filter(row => number(row.FeeTotNtv) !== null && number(row.BlkCnt) > 0);
  const selected = new Set();
  const rolling = [];
  for (let i = 0; i < valid.length; i++) {
    const cutoff = day(dateOf(valid[i])) - 6 * DAY;
    let start = i;
    while (start > 0 && day(dateOf(valid[start - 1])) >= cutoff) start--;
    const window = valid.slice(start, i + 1);
    const fees = window.reduce((sum, row) => sum + number(row.FeeTotNtv), 0);
    const blocks = window.reduce((sum, row) => sum + number(row.BlkCnt), 0);
    rolling.push(blocks > 0 ? fees / blocks : null);
    const elapsed = Math.round((day(dateOf(valid[i])) - day(dateOf(valid[0]))) / DAY);
    if (i === 0 || elapsed % 7 === 0 || i === valid.length - 1) selected.add(i);
    const daily = number(valid[i].FeeTotNtv) / number(valid[i].BlkCnt);
    if (daily > 0.5 && rolling[i] !== null && daily > rolling[i] * 2) {
      selected.add(Math.max(0, i - 1));
      selected.add(i);
      selected.add(Math.min(valid.length - 1, i + 1));
    }
  }
  return [...selected].sort((a, b) => a - b).map(i => [dateOf(valid[i]), significant(rolling[i] ?? 0, 8)]);
}

function smoothedTransactions(rows) {
  return rollingSeries(rows, 7, window => {
    const values = window.map(row => number(row.TxCnt)).filter(value => value !== null && value >= 0);
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  });
}

function heights(rows) {
  const result = [[START, 0]];
  // Block height is zero-based while BlkCnt is a count, so Genesis contributes
  // one observed block but leaves the displayed height at zero.
  let height = -1;
  let firstDate = null;
  for (let i = 0; i < rows.length; i++) {
    const blocks = number(rows[i].BlkCnt);
    if (blocks !== null && blocks > 0) height += Math.round(blocks);
    if (firstDate === null) firstDate = dateOf(rows[i]);
    const elapsed = Math.round((day(dateOf(rows[i])) - day(firstDate)) / DAY);
    if (elapsed % 7 === 0 || i === rows.length - 1) result.push([dateOf(rows[i]), Math.max(0, height)]);
  }
  return result.filter((entry, index, list) => index === 0 || entry[0] !== list[index - 1][0]);
}

function render(data) {
  const generated = new Date().toISOString();
  const lines = [
    "\"use strict\";",
    "/* Generated by scripts/build-historical-data.mjs. Do not edit by hand. */",
    `window.HISTORICAL_DATA = ${JSON.stringify({
      meta: {
        source: "Coin Metrics Community Network Data · mempool.space difficulty adjustments",
        sourceUrl: "https://community-api.coinmetrics.io/v4/timeseries/asset-metrics",
        difficultySourceUrl: RETARGET_ENDPOINT,
        generated,
        through: END,
        transforms: {
          price: "daily recorded PriceUSD after market launch; four manual discovery anchors before coverage",
          hash: "14-day trailing mean of recorded daily HashRate, sampled weekly",
          difficulty: "one exact value per 2016-block retarget, held until the next one; the protocol changes it nowhere else",
          fees: "seven-day total fees divided by seven-day blocks, sampled weekly with high-fee outliers retained",
          transactions: "seven-day trailing mean of recorded TxCnt, sampled weekly",
          height: "cumulative recorded daily block count, sampled weekly",
        },
      },
      ...data,
    })};`,
    "",
  ];
  return lines.join("\n");
}

const difficultyOnly = process.argv.includes("--difficulty-only");
if (difficultyOnly) {
  // Rewrites only the DIFFICULTY array in the existing bundle, so a targeted accuracy
  // fix cannot quietly pull unrelated revisions into every other series.
  const existing = readFileSync(OUTPUT, "utf8");
  const payload = JSON.parse(existing.slice(existing.indexOf("{"), existing.lastIndexOf("}") + 1));
  const next = difficulty(await fetchRetargets());
  console.log(`DIFFICULTY ${payload.DIFFICULTY.length} -> ${next.length} points`);
  payload.DIFFICULTY = next;
  payload.meta.source = "Coin Metrics Community Network Data · mempool.space difficulty adjustments";
  payload.meta.difficultySourceUrl = RETARGET_ENDPOINT;
  payload.meta.transforms.difficulty = "one exact value per 2016-block retarget, held until the next one; the protocol changes it nowhere else";
  await writeFile(OUTPUT, [
    "\"use strict\";",
    "/* Generated by scripts/build-historical-data.mjs. Do not edit by hand. */",
    `window.HISTORICAL_DATA = ${JSON.stringify(payload)};`,
    "",
  ].join("\n"), "utf8");
  process.exit(0);
}

const rows = await fetchRows();
if (!rows.length) throw new Error("Coin Metrics returned no BTC rows");
const data = {
  PRICE: dailyPrice(rows),
  HASH: smoothedHash(rows),
  DIFFICULTY: difficulty(await fetchRetargets()),
  FEES: smoothedFees(rows),
  TX: smoothedTransactions(rows),
  HEIGHT: heights(rows),
};
await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, render(data), "utf8");
console.log(Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value.length])));
