import { describe, expect, it } from "vitest";
import { getItemsInGroup } from "../src/taxonomy";

describe("browse groups", () => {
  it("changes the emoji grid when the user chooses another group", () => {
    const smileys = getItemsInGroup("emoji", "smileys");
    const animals = getItemsInGroup("emoji", "animals");

    expect(smileys).toHaveLength(167);
    expect(animals).toHaveLength(153);
    expect(smileys.every((item) => item.c === "smileys-emotion")).toBe(true);
    expect(animals.every((item) => item.c === "animals-nature")).toBe(true);
    expect(smileys.map((item) => item.t)).not.toEqual(animals.map((item) => item.t));
  });

  it("uses a bounded kaomoji group instead of all 9,884 kaomoji", () => {
    const animals = getItemsInGroup("kaomoji", "animals-nature");
    expect(animals).toHaveLength(1538);
    expect(animals.every((item) => item.y === "kaomoji")).toBe(true);
  });
});
