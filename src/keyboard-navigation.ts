// keyboard-navigation.ts — arrow-key movement across search, controls, and glyphs.
// Search input keeps native left/right caret behavior; only Up/Down leave it.

import { getState } from "./state";

type NavZone = "filter" | "tab" | "chip" | "grid";

export function installKeyboardNavigation(): void {
  document.addEventListener("keydown", handleKeydown);
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.altKey || event.ctrlKey || event.metaKey) return;

  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  // Do not intercept left/right in the text field: they must always move the
  // caret. Down moves to the first relevant navigation layer instead.
  if (target instanceof HTMLInputElement && target.matches(".i-search-input")) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusBelowSearch();
    }
    return;
  }

  const zone = navZoneOf(target);
  if (!zone) return;

  if (zone === "grid" && event.key === "Enter") {
    event.preventDefault();
    if (!event.repeat) (target as HTMLButtonElement).click();
    return;
  }

  switch (zone) {
    case "filter":
      navigateFilter(target, event);
      break;
    case "tab":
      navigateTab(target, event);
      break;
    case "chip":
      navigateChip(target, event);
      break;
    case "grid":
      navigateGrid(target as HTMLButtonElement, event);
      break;
  }
}

function navigateFilter(current: HTMLElement, event: KeyboardEvent): void {
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    activateHorizontalSibling(current, "filter", event.key === "ArrowRight" ? 1 : -1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    focusSearchInput();
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    focusFirstGridCell();
  }
}

function navigateTab(current: HTMLElement, event: KeyboardEvent): void {
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    activateHorizontalSibling(current, "tab", event.key === "ArrowRight" ? 1 : -1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    focusSearchInput();
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    focusActiveChipOrFirstGrid();
  }
}

function navigateChip(current: HTMLElement, event: KeyboardEvent): void {
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    activateHorizontalSibling(current, "chip", event.key === "ArrowRight" ? 1 : -1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    focusActive("tab");
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    focusFirstGridCell();
  }
}

function navigateGrid(current: HTMLButtonElement, event: KeyboardEvent): void {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
    return;
  }
  event.preventDefault();

  const grid = current.closest<HTMLElement>(".i-grid");
  if (!grid) return;
  const cells = Array.from(grid.querySelectorAll<HTMLButtonElement>(".i-cell"));
  const index = cells.indexOf(current);
  if (index < 0 || cells.length === 0) return;

  if (event.key === "Home") {
    focus(cells[0]);
    return;
  }
  if (event.key === "End") {
    focus(cells[cells.length - 1]);
    return;
  }

  const columns = gridColumnCount(cells);
  if (event.key === "ArrowLeft" && index > 0) {
    focus(cells[index - 1]);
    return;
  }
  if (event.key === "ArrowRight" && index < cells.length - 1) {
    focus(cells[index + 1]);
    return;
  }
  if (event.key === "ArrowDown") {
    const next = index + columns;
    if (next < cells.length) {
      focus(cells[next]);
    } else {
      focusFirstCellInNextGrid(grid);
    }
    return;
  }
  if (event.key === "ArrowUp") {
    const previous = index - columns;
    if (previous >= 0) {
      focus(cells[previous]);
    } else {
      focusLastCellInPreviousGridOrControls(grid);
    }
  }
}

function focusBelowSearch(): void {
  if (getState().mode === "search") {
    focusActive("filter");
  } else {
    focusActive("tab");
  }
}

function focusActiveChipOrFirstGrid(): void {
  const chip = activeElement("chip");
  if (chip) focus(chip);
  else focusFirstGridCell();
}

function focusActive(zone: Exclude<NavZone, "grid">): void {
  const element = activeElement(zone);
  if (element) focus(element);
}

function activeElement(zone: Exclude<NavZone, "grid">): HTMLElement | null {
  const activeClass = zone === "filter" ? ".i-filter-active" : zone === "tab" ? ".i-tab-active" : ".i-chip-active";
  return document.querySelector<HTMLElement>(`${activeClass}[data-nav-zone="${zone}"]`)
    ?? document.querySelector<HTMLElement>(`[data-nav-zone="${zone}"]`);
}

function activateHorizontalSibling(current: HTMLElement, zone: Exclude<NavZone, "grid">, delta: number): void {
  const siblings = Array.from(document.querySelectorAll<HTMLButtonElement>(`[data-nav-zone="${zone}"]`));
  const index = siblings.indexOf(current as HTMLButtonElement);
  if (index < 0 || siblings.length === 0) return;

  const nextIndex = Math.max(0, Math.min(siblings.length - 1, index + delta));
  if (nextIndex === index) return;

  // Selecting on arrow movement makes Down always enter the matching children.
  siblings[nextIndex].click();
  window.requestAnimationFrame(() => {
    const replacement = document.querySelector<HTMLElement>(
      `[data-nav-zone="${zone}"][data-nav-index="${nextIndex}"]`
    );
    if (replacement) focus(replacement);
  });
}

function focusFirstGridCell(): void {
  const first = document.querySelector<HTMLButtonElement>("#content .i-cell");
  if (first) focus(first);
}

function focusFirstCellInNextGrid(currentGrid: HTMLElement): void {
  const grids = Array.from(document.querySelectorAll<HTMLElement>("#content .i-grid"));
  const index = grids.indexOf(currentGrid);
  const next = index >= 0 ? grids[index + 1] : undefined;
  const first = next?.querySelector<HTMLButtonElement>(".i-cell");
  if (first) focus(first);
}

function focusLastCellInPreviousGridOrControls(currentGrid: HTMLElement): void {
  const grids = Array.from(document.querySelectorAll<HTMLElement>("#content .i-grid"));
  const index = grids.indexOf(currentGrid);
  const previous = index > 0 ? grids[index - 1] : undefined;
  const cells = previous
    ? Array.from(previous.querySelectorAll<HTMLButtonElement>(".i-cell"))
    : [];

  if (cells.length > 0) {
    focus(cells[cells.length - 1]);
  } else if (getState().mode === "search") {
    focusActive("filter");
  } else {
    focusActive("chip");
  }
}

function gridColumnCount(cells: HTMLButtonElement[]): number {
  if (cells.length <= 1) return 1;
  const firstRowTop = cells[0].offsetTop;
  const nextRowStart = cells.findIndex((cell) => cell.offsetTop !== firstRowTop);
  return nextRowStart > 0 ? nextRowStart : cells.length;
}

function navZoneOf(element: HTMLElement): NavZone | null {
  const zone = element.closest<HTMLElement>("[data-nav-zone]")?.dataset.navZone;
  return zone === "filter" || zone === "tab" || zone === "chip" || zone === "grid"
    ? zone
    : null;
}

function focus(element: HTMLElement): void {
  element.focus({ preventScroll: true });
  element.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function focusSearchInput(): void {
  const input = document.querySelector<HTMLInputElement>(".i-search-input");
  if (input) focus(input);
}
