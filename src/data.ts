// data.ts — load + cache data.json (14,870 items).
// Bundle JSON vào frontend qua Vite (resolveJsonModule).

import type { IconItem } from "./types";
import data from "./data.json";

let cached: IconItem[] | null = null;

export function getAllItems(): IconItem[] {
  if (cached) return cached;
  cached = data as IconItem[];
  return cached;
}

export function getItemCount(): number {
  return getAllItems().length;
}

export function getItemsByType(type: IconItem["y"]): IconItem[] {
  return getAllItems().filter((item) => item.y === type);
}

export function getItemsByCategory(
  type: IconItem["y"],
  categories: string[]
): IconItem[] {
  const set = new Set(categories);
  return getItemsByType(type)
    .filter((item) => set.has(item.c))
    .sort((a, b) => a.n.localeCompare(b.n));
}
