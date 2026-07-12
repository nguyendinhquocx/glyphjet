// ui/grid.ts — render glyph cells. Emoji/symbol dùng square grid; kaomoji dùng
// 3-column text grid để chuỗi dài không phá layout hoặc tạo horizontal scroll.

import type { IconItem } from "../types";

export type GridPickHandler = (item: IconItem, cell: HTMLButtonElement) => void;

export function renderGrid(items: IconItem[], onPick: GridPickHandler): HTMLElement {
  const grid = document.createElement("div");
  const isKaomojiGrid = items.length > 0 && items.every((item) => item.y === "kaomoji");
  grid.className = "i-grid" + (isKaomojiGrid ? " i-grid-kaomoji" : "");

  for (const item of items) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "i-cell";
    cell.title = item.n || item.t;
    cell.setAttribute("aria-label", item.n || item.t);

    if (item.y === "kaomoji") {
      cell.classList.add("i-cell-kaomoji", kaomojiLengthClass(item.t));
    } else if (item.y === "symbol") {
      cell.classList.add("i-cell-symbol");
    }

    cell.textContent = item.t;
    cell.addEventListener("click", () => onPick(item, cell));
    grid.appendChild(cell);
  }
  return grid;
}

function kaomojiLengthClass(text: string): string {
  const length = Array.from(text).length;
  if (length > 28) return "i-cell-kaomoji-long";
  if (length > 18) return "i-cell-kaomoji-medium";
  return "i-cell-kaomoji-short";
}
