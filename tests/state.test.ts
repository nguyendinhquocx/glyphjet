import { beforeEach, describe, expect, it } from "vitest";
import { getState, setBrowse, setQuery, setState } from "../src/state";
import type { IconItem } from "../src/types";

const INITIAL_STATE = {
  mode: "browse" as const,
  query: "",
  currentType: "emoji" as const,
  currentGroup: "smileys",
  results: [],
  isLoading: false,
};

describe("transient search state", () => {
  beforeEach(() => {
    setState(INITIAL_STATE);
  });

  it("clears a query without losing the saved browse type or category", () => {
    setBrowse("kaomoji", "animals-nature");
    setQuery("cat");
    const cat: IconItem = {
      t: "🐱",
      y: "emoji",
      c: "animals-nature",
      s: "animal-mammal",
      n: "cat",
      g: "cat animal emoji",
    };
    setState({ results: [cat], isLoading: false });

    setQuery("");

    expect(getState()).toMatchObject({
      mode: "browse",
      query: "",
      currentType: "kaomoji",
      currentGroup: "animals-nature",
      results: [],
      isLoading: false,
    });
  });
});
