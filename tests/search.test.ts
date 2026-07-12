// tests/search.test.ts — verify port search.ts không drift.
// Chạy: pnpm test

import { describe, it, expect } from "vitest";
import { initSearch, search } from "../src/search";
import data from "../src/data.json";

describe("search engine port", () => {
  it("initializes within budget for 14870 items", () => {
    const elapsed = initSearch(data);
    // Index build nên < 1000ms trong Node (webview thường nhanh hơn).
    expect(elapsed).toBeLessThan(2000);
  });

  it("returns bear emoji for query 'bear'", () => {
    initSearch(data);
    const results = search("bear", { limit: 10 });
    const texts = results.map((r) => r.t);
    expect(texts).toContain("🐻");
  });

  it("returns arrow symbol for query 'arrow'", () => {
    initSearch(data);
    const results = search("arrow", { limit: 20, type: "symbol" });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.y === "symbol")).toBe(true);
  });

  it("respects type filter", () => {
    initSearch(data);
    const results = search("love", { limit: 20, type: "kaomoji" });
    expect(results.every((r) => r.y === "kaomoji")).toBe(true);
  });

  it("exact glyph paste resolves via O(1) path", () => {
    initSearch(data);
    const results = search("→", {});
    expect(results.map((r) => r.t)).toContain("→");
  });

  it("empty query returns empty (no browse-all)", () => {
    initSearch(data);
    expect(search("", {})).toEqual([]);
  });
});
