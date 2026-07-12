// bench-search.mjs — benchmark FlexSearch với data.json (port từ web).
// Usage: node scripts/bench-search.mjs

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";

const ROOT = new URL("../", import.meta.url);
const data = JSON.parse(
  readFileSync(new URL("src/data.json", ROOT), "utf-8")
);

// Inline a minimal FlexSearch-like init + search for benchmark.
// Production frontend dùng flexsearch npm package; script này verify timing
// trên Node để so sánh với web project scripts/bench-search.mjs.
const { default: FlexSearch } = await import("flexsearch").catch(() => ({}));

if (!FlexSearch) {
  console.log("flexsearch not installed, skipping benchmark.");
  process.exit(0);
}

const index = new FlexSearch.Index({
  encode: (str) => str.toLowerCase().match(/[a-z0-9]+/g) ?? [],
  tokenize: "forward",
  resolution: 9,
});

const t0 = performance.now();
for (let i = 0; i < data.length; i++) {
  const item = data[i];
  index.add(i, `${item.g} ${item.n} ${item.s ?? ""}`);
}
const indexMs = performance.now() - t0;

const queries = ["bear", "love", "heart", "arrow", "cat", "happy", "crying", "star"];

const t1 = performance.now();
let total = 0;
for (const q of queries) {
  const ids = index.search(q, 48);
  total += ids.length;
}
const searchMs = performance.now() - t1;

console.log(`Index build: ${indexMs.toFixed(1)} ms (${data.length} items)`);
console.log(`Search ${queries.length} queries: ${searchMs.toFixed(1)} ms total`);
console.log(`Avg per query: ${(searchMs / queries.length).toFixed(2)} ms`);
console.log(`Total hits: ${total}`);
