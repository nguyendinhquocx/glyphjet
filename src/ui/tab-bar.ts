// ui/tab-bar.ts — Emoji / Symbols / Kaomoji tabs.

import type { IconType } from "../types";

const TABS: { id: IconType; label: string }[] = [
  { id: "emoji", label: "Emoji" },
  { id: "symbol", label: "Symbols" },
  { id: "kaomoji", label: "Kaomoji" },
];

export function renderTabBar(
  current: IconType,
  onSelect: (type: IconType) => void
): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "i-tab-bar";
  for (const tab of TABS) {
    const btn = document.createElement("button");
    btn.className = "i-tab" + (tab.id === current ? " i-tab-active" : "");
    btn.textContent = tab.label;
    btn.addEventListener("click", () => onSelect(tab.id));
    bar.appendChild(btn);
  }
  return bar;
}
