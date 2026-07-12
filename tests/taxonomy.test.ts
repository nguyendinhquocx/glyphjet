// tests/taxonomy.test.ts — verify mapping cover 128 categories.
// Chạy: pnpm test

import { describe, it, expect } from "vitest";
import taxonomy from "../src/taxonomy.json";
import data from "../src/data.json";

describe("taxonomy mapping", () => {
  it("covers all emoji categories", () => {
    const actual = new Set(
      data.filter((x) => x.y === "emoji").map((x) => x.c)
    );
    const mapped = new Set(
      taxonomy.emoji.flatMap((g) => g.categories)
    );
    for (const cat of actual) {
      expect(mapped.has(cat)).toBe(true);
    }
  });

  it("covers all symbol categories", () => {
    const actual = new Set(
      data.filter((x) => x.y === "symbol").map((x) => x.c)
    );
    const mapped = new Set(
      taxonomy.symbol.flatMap((g) => g.categories)
    );
    for (const cat of actual) {
      expect(mapped.has(cat)).toBe(true);
    }
  });

  it("covers all kaomoji categories (catch-all policy)", () => {
    const actual = new Set(
      data.filter((x) => x.y === "kaomoji").map((x) => x.c)
    );
    const mapped = new Set(
      taxonomy.kaomoji.flatMap((g) => g.categories)
    );
    for (const cat of actual) {
      expect(mapped.has(cat)).toBe(true);
    }
  });

  it("has 9 emoji + 11 symbol + 15 kaomoji groups", () => {
    expect(taxonomy.emoji.length).toBe(9);
    expect(taxonomy.symbol.length).toBe(11);
    expect(taxonomy.kaomoji.length).toBe(15);
  });
});
