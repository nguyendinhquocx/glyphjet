// main.ts — UI state machine. Search input chỉ remount khi đổi browse/search mode,
// không bị hủy sau từng keystroke.

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getAllItems } from "./data";
import { getDefaultGroup, getGroups, getItemsInGroup } from "./taxonomy";
import { initSearch, search, type SearchItem } from "./search";
import { getState, setBrowse, setQuery, setState } from "./state";
import { copyGlyph } from "./clipboard-bridge";
import { getSettings, saveBrowseState } from "./settings-bridge";
import { renderTabBar } from "./ui/tab-bar";
import { renderChipBar } from "./ui/chip-bar";
import { renderGrid } from "./ui/grid";
import { renderSearchResults } from "./ui/search-results";
import { renderSearchBar } from "./ui/search-bar";
import { renderEmpty, renderLoading } from "./ui/empty";
import { installKeyboardNavigation } from "./keyboard-navigation";
import type { IconItem, IconType } from "./types";

const DEBOUNCE_MS = 80;
const SEARCH_RESULT_LIMIT = 36;
let searchFilter: IconType | "all" = "all";
let debounceTimer: number | null = null;
let copyFeedbackTimer: number | null = null;
let searchInitialized = false;

function ensureSearchInit(): void {
  if (searchInitialized) return;
  initSearch(getAllItems() as unknown as SearchItem[]);
  searchInitialized = true;
}

function currentItems(): IconItem[] {
  const state = getState();
  return state.mode === "search"
    ? state.results
    : getItemsInGroup(state.currentType, state.currentGroup);
}

function requiresMoreText(query: string): boolean {
  // Một chữ Latin ("h") match quá nhiều prefix. Glyph Unicode như → vẫn được
  // search exact ngay vì không match regex này.
  return /^[a-z]$/i.test(query.trim());
}

function renderContent(): void {
  const root = document.getElementById("content");
  if (!root) return;
  root.replaceChildren();

  const state = getState();
  if (state.isLoading) {
    root.appendChild(renderLoading());
    return;
  }
  if (state.mode === "search" && requiresMoreText(state.query)) {
    root.appendChild(renderEmpty("Type at least 2 letters to search"));
    return;
  }

  const items = currentItems();
  if (items.length === 0) {
    root.appendChild(renderEmpty(state.mode === "search" ? "No glyphs found" : "Empty group"));
    return;
  }

  const onPick = (item: IconItem, cell: HTMLButtonElement): void => {
    void copyGlyph(item.t)
      .then(() => showCopyFeedback(cell, item.t, true))
      .catch(() => showCopyFeedback(cell, item.t, false));
  };

  root.appendChild(
    state.mode === "search"
      ? renderSearchResults(items, searchFilter, onPick)
      : renderGrid(items, onPick)
  );
}

function renderChrome(restoreInputFocus = false): void {
  const chrome = document.getElementById("chrome");
  if (!chrome) return;
  chrome.replaceChildren();

  const state = getState();
  chrome.appendChild(
    renderSearchBar(
      state.query,
      searchFilter,
      state.mode === "search",
      onQuery,
      onFilter
    )
  );

  // Browse có một bộ chọn type duy nhất. Search mới có filter All/type riêng.
  if (state.mode === "browse") {
    chrome.appendChild(renderTabBar(state.currentType, onTypeChange));
    chrome.appendChild(renderChipBar(state.currentType, state.currentGroup, onGroupChange));
  }

  if (restoreInputFocus) focusSearchInput();
}

function focusSearchInput(): void {
  window.requestAnimationFrame(() => {
    const input = document.querySelector<HTMLInputElement>(".i-search-input");
    if (!input) return;
    input.focus({ preventScroll: true });
    const caret = input.value.length;
    input.setSelectionRange(caret, caret);
  });
}

function resetSearchOnPopupOpen(): void {
  // Every open starts from the first view: Emoji → Smileys, empty query.
  // Nothing about the last session (tab, category, search) is carried over.
  cancelPendingSearch();
  searchFilter = "all";
  setBrowse("emoji", getDefaultGroup("emoji"));
  setQuery("");
  renderChrome();
  renderContent();
  focusSearchInput();
}

function cancelPendingSearch(): void {
  if (debounceTimer !== null) {
    window.clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}

function scheduleSearch(query: string): void {
  cancelPendingSearch();
  debounceTimer = window.setTimeout(() => {
    // Không render kết quả query cũ sau khi user đã gõ tiếp.
    if (getState().query !== query) return;
    ensureSearchInit();
    const results = search(query, {
      limit: SEARCH_RESULT_LIMIT,
      type: searchFilter === "all" ? undefined : searchFilter,
    }) as unknown as IconItem[];
    setState({ results, isLoading: false });
    renderContent();
  }, DEBOUNCE_MS);
}

function onQuery(query: string): void {
  cancelPendingSearch();
  const wasSearch = getState().mode === "search";
  setQuery(query);

  if (query.trim() === "") {
    if (wasSearch) renderChrome(true);
    renderContent();
    return;
  }

  const enteredSearch = !wasSearch;
  if (enteredSearch) renderChrome(true);

  if (requiresMoreText(query)) {
    setState({ results: [], isLoading: false });
    renderContent();
    return;
  }

  // Giữ kết quả cũ trong lúc gõ tiếp; không clear/rebuild 36 cell mỗi key.
  if (enteredSearch) renderContent();
  scheduleSearch(query);
}

function onFilter(filter: IconType | "all"): void {
  if (searchFilter === filter) return;
  searchFilter = filter;
  const state = getState();
  renderChrome(true);

  if (state.mode !== "search" || state.query.trim() === "") return;
  if (requiresMoreText(state.query)) {
    setState({ results: [], isLoading: false });
    renderContent();
    return;
  }
  setState({ isLoading: true });
  renderContent();
  scheduleSearch(state.query);
}

function onTypeChange(type: IconType): void {
  const groupId = getDefaultGroup(type);
  setBrowse(type, groupId);
  void saveBrowseState(type, groupId).catch((error: unknown) => {
    console.warn("[glyphjet] cannot save browse state", error);
  });
  renderChrome();
  renderContent();
}

function onGroupChange(groupId: string): void {
  const state = getState();
  setBrowse(state.currentType, groupId);
  void saveBrowseState(state.currentType, groupId).catch((error: unknown) => {
    console.warn("[glyphjet] cannot save browse state", error);
  });

  // Toggle the active chip in place instead of rebuilding the whole chrome.
  // Rebuilding would reset the horizontal scroll position and snap the chip
  // bar back to the first group, which feels broken when the user just
  // scrolled over to pick a later group.
  document.querySelectorAll(".i-chip").forEach((chip) => {
    chip.classList.toggle("i-chip-active", chip.getAttribute("data-group-id") === groupId);
  });
  renderContent();
}

function showCopyFeedback(cell: HTMLButtonElement, glyph: string, copied: boolean): void {
  if (copyFeedbackTimer !== null) window.clearTimeout(copyFeedbackTimer);
  document.querySelectorAll(".i-cell-copied, .i-cell-copy-error").forEach((other) => {
    other.classList.remove("i-cell-copied", "i-cell-copy-error");
  });

  cell.classList.add(copied ? "i-cell-copied" : "i-cell-copy-error");
  document.getElementById("copy-status")!.textContent = copied
    ? `${glyph} copied to clipboard`
    : "Copy failed";

  copyFeedbackTimer = window.setTimeout(() => {
    cell.classList.remove("i-cell-copied", "i-cell-copy-error");
    const status = document.getElementById("copy-status");
    if (status) status.textContent = "";
  }, copied ? 1200 : 1800);
}

async function init(): Promise<void> {
  // Attach the focus listener before any heavy work so the first popup show
  // is not missed while the search index is still building.
  void listen("glyphjet-shown", resetSearchOnPopupOpen).catch((error: unknown) => {
    console.warn("[glyphjet] focus event unavailable", error);
  });

  // Index build happens while the spotlight is still hidden, so the first
  // hotkey open has browse/search ready instantly.
  ensureSearchInit();
  const settings = await getSettings();

  const validType = (["emoji", "symbol", "kaomoji"] as IconType[]).includes(settings.last_type)
    ? settings.last_type
    : "emoji";
  const groups = getGroups(validType);
  const validGroup = groups.some((group) => group.id === settings.last_category)
    ? settings.last_category
    : getDefaultGroup(validType);

  setState({
    mode: "browse",
    query: "",
    currentType: validType,
    currentGroup: validGroup,
    results: [],
    isLoading: false,
  });

  renderChrome();
  renderContent();
  // Focus the input once the initial UI is mounted so the very first open
  // lands the caret in search without needing a separate focus event.
  focusSearchInput();

  installKeyboardNavigation();

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") void invoke("hide_popup").catch(() => undefined);
  });
}

void init().catch((error: unknown) => {
  console.error("[glyphjet] startup failed", error);
  document.getElementById("chrome")?.replaceChildren();
  document
    .getElementById("content")
    ?.replaceChildren(renderEmpty("GlyphJet could not load. Restart the app."));
});
