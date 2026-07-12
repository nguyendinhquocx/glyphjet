// ui/empty.ts — empty/error state.

export function renderEmpty(message: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "i-empty";
  el.textContent = message;
  return el;
}

export function renderLoading(): HTMLElement {
  const el = document.createElement("div");
  el.className = "i-empty i-loading";
  el.textContent = "Searching…";
  return el;
}
