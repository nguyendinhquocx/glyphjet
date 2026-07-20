// ui/chip-bar.ts — sub-category chips (scroll ngang).

import type { IconType, TaxonomyGroup } from "../types";
import { getGroups } from "../taxonomy";

export function renderChipBar(
  type: IconType,
  currentGroup: string,
  onSelect: (groupId: string) => void
): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "i-chip-bar";
  const groups: TaxonomyGroup[] = getGroups(type);
  for (const [index, group] of groups.entries()) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "i-chip" + (group.id === currentGroup ? " i-chip-active" : "");
    chip.dataset.navZone = "chip";
    chip.dataset.navIndex = String(index);
    chip.dataset.groupId = group.id;
    chip.setAttribute("aria-pressed", String(group.id === currentGroup));
    chip.textContent = group.label;
    chip.addEventListener("click", () => onSelect(group.id));
    bar.appendChild(chip);
  }
  return bar;
}
