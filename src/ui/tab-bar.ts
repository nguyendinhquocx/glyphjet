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
  bar.setAttribute("role", "tablist");
  for (const [index, tab] of TABS.entries()) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "i-tab" + (tab.id === current ? " i-tab-active" : "");
    btn.dataset.navZone = "tab";
    btn.dataset.navIndex = String(index);
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", String(tab.id === current));
    btn.textContent = tab.label;
    btn.addEventListener("click", () => onSelect(tab.id));
    bar.appendChild(btn);
  }
  return bar;
}
