// ui/search-results.ts — All search được group theo type thay vì trộn glyph
// vào một grid. User nhìn phát biết thứ nào là emoji, symbol hay kaomoji.

import type { IconItem, IconType } from "../types";
import { renderGrid, type GridPickHandler } from "./grid";

const TYPE_ORDER: IconType[] = ["emoji", "symbol", "kaomoji"];
const TYPE_LABEL: Record<IconType, string> = {
  emoji: "Emoji",
  symbol: "Symbols",
  kaomoji: "Kaomoji",
};

export function renderSearchResults(
  items: IconItem[],
  filter: IconType | "all",
  onPick: GridPickHandler
): HTMLElement {
  const root = document.createElement("div");
  root.className = "i-search-results";
  const types = filter === "all" ? TYPE_ORDER : [filter];

  for (const type of types) {
    const matches = items.filter((item) => item.y === type);
    if (matches.length === 0) continue;

    const section = document.createElement("section");
    section.className = "i-search-section";

    if (filter === "all") {
      const heading = document.createElement("h2");
      heading.className = "i-search-section-title";
      heading.textContent = TYPE_LABEL[type];
      section.appendChild(heading);
    }

    section.appendChild(renderGrid(matches, onPick));
    root.appendChild(section);
  }

  return root;
}
