// state.ts — UI state single source of truth (STRUCTURE.md 5.2).

import type { IconType, UIState } from "./types";

const state: UIState = {
  mode: "browse",
  query: "",
  currentType: "emoji",
  currentGroup: "smileys",
  results: [],
  isLoading: false,
};

export function getState(): UIState {
  return state;
}

export function setState(patch: Partial<UIState>): UIState {
  Object.assign(state, patch);
  return state;
}

export function setBrowse(type: IconType, groupId: string): UIState {
  return setState({ mode: "browse", currentType: type, currentGroup: groupId, query: "" });
}

export function setQuery(query: string): UIState {
  if (query.trim() === "") {
    return setState({ mode: "browse", query: "", results: [], isLoading: false });
  }
  return setState({ mode: "search", query, isLoading: true });
}
