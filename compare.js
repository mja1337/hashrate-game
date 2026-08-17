// compare.js
// Reads BTC price and hash rate CSVs from /tmp, compares to in-game anchors in index.html, reports large deviations (>10%).
const fs = require('fs');
const path = require('path');

function parseCSV(filePath) {
  const data = fs.readFileSync(filePath, 'utf8');
  const lines = data.split(/\r?\n/).filter(l => l.trim().length > 0);
  const header = lines[0].split(',');
  const rows = lines.slice(1).map(line => {
    const cols = line.split(',');
    const obj = {};
    for (let i = 0; i < header.length; i++) {
      obj[header[i]] = cols[i];
    }
    return obj;
  });
  return { header, rows };
}

function loadPriceMap() {
  const { rows } = parseCSV('/tmp/btc_price.csv');
  const map = new Map();
  for (const r of rows) {
    const date = r.time; // format YYYY-MM-DD
    const price = parseFloat(r.PriceUSD);
    if (!isNaN(price)) {
      map.set(date, price);
    }
  }
  return map;
}

function loadHashMap() {
  const { rows } = parseCSV('/tmp/btc_hashrate.csv');
  const map = new Map();
  for (const r of rows) {
    const date = r.time;
    const hash = parseFloat(r.HashRate);
    if (!isNaN(hash)) {
      map.set(date, hash);
    }
  }
  return map;
}

function loadGameData() {
  // Dynamically read the index.html to extract PRICE and HASH arrays.
  const indexPath = path.resolve(__dirname, 'index.html');
  const content = fs.readFileSync(indexPath, 'utf8');
  // Use multiline regex to capture the array contents including line breaks.
  const priceMatch = content.match(/const PRICE=\[((?:.|\n)*?)\];/);
  const hashMatch = content.match(/const HASH=\[((?:.|\n)*?)\];/);
  const priceArray = [];
  const hashArray = [];
  if (priceMatch) {
    // Split on '],[' while handling optional whitespace and line breaks.
    const entries = priceMatch[1].trim().split(/\],\s*\[/);
    for (let e of entries) {
      e = e.replace(/[\[\]]/g, '').trim();
      const parts = e.split(',');
      const date = parts[0].replace(/"/g, '').trim();
      const val = parseFloat(parts[1]);
      if (date && !isNaN(val)) priceArray.push([date, val]);
    }
  }
  if (hashMatch) {
    const entries = hashMatch[1].trim().split(/\],\s*\[/);
    for (let e of entries) {
      e = e.replace(/[\[\]]/g, '').trim();
      const parts = e.split(',');
      const date = parts[0].replace(/"/g, '').trim();
      const val = parseFloat(parts[1]);
      if (date && !isNaN(val)) hashArray.push([date, val]);
    }
  }
  return { priceArray, hashArray };
}

function getClosest(map, targetDate) {
  // If exact match exists, return it.
  if (map.has(targetDate)) return map.get(targetDate);
  // Otherwise, find the nearest earlier date (fallback to later if none earlier).
  const dates = Array.from(map.keys()).sort();
  let closest = null;
  for (const d of dates) {
    if (d <= targetDate) closest = d; else break;
  }
  if (closest) return map.get(closest);
  // As a last resort, return the first entry.
  return map.get(dates[0]);
}

function compare(map, gameArray, type) {
  const deviations = [];
  for (const [date, gameVal] of gameArray) {
    const real = getClosest(map, date);
    if (real !== undefined && real !== 0) {
      const err = ((gameVal - real) / real) * 100;
      if (Math.abs(err) > 10) {
        deviations.push({ date, game: gameVal, real, err });
      }
    }
  }
  return deviations;
}

function main() {
  const priceMap = loadPriceMap();
  const hashMap = loadHashMap();
  const { priceArray, hashArray } = loadGameData();
  const priceDev = compare(priceMap, priceArray, 'price');
  const hashDev = compare(hashMap, hashArray, 'hash');
  console.log('=== Price deviations >10% ===');
  priceDev.forEach(d => {
    console.log(`${d.date}: game=${d.game}, real=${d.real.toFixed(2)}, err=${d.err.toFixed(2)}%`);
  });
  console.log('\n=== Hashrate deviations >10% ===');
  hashDev.forEach(d => {
    console.log(`${d.date}: game=${d.game}, real=${d.real.toExponential(2)}, err=${d.err.toFixed(2)}%`);
  });
}

main();
