// ui/search-bar.ts — persistent query input + search-only type filter.

import type { IconType } from "../types";

const FILTERS: { id: IconType | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "emoji", label: "Emoji" },
  { id: "symbol", label: "Symbols" },
  { id: "kaomoji", label: "Kaomoji" },
];

export function renderSearchBar(
  query: string,
  filter: IconType | "all",
  showFilters: boolean,
  onQuery: (query: string) => void,
  onFilter: (filter: IconType | "all") => void
): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "i-search-bar";

  const input = document.createElement("input");
  input.className = "i-search-input";
  input.type = "text";
  input.value = query;
  input.placeholder = "";
  input.dataset.navZone = "search";
  input.setAttribute("aria-label", "Search glyphs");
  input.autocomplete = "off";
  input.spellcheck = false;
  input.addEventListener("input", () => onQuery(input.value));
  wrap.appendChild(input);

  // All/Emoji/Symbols/Kaomoji chỉ có nghĩa lúc search. Browse đã có tab type,
  // render cả hai cùng lúc làm user tưởng filter hỏng.
  if (showFilters) {
    const filters = document.createElement("div");
    filters.className = "i-filter-row";
    filters.setAttribute("aria-label", "Search result type");
    for (const [index, item] of FILTERS.entries()) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "i-filter" + (item.id === filter ? " i-filter-active" : "");
      chip.dataset.navZone = "filter";
      chip.dataset.navIndex = String(index);
      chip.textContent = item.label;
      chip.setAttribute("aria-pressed", String(item.id === filter));
      chip.addEventListener("click", () => onFilter(item.id));
      filters.appendChild(chip);
    }
    wrap.appendChild(filters);
  }

  return wrap;
}
