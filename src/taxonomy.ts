// taxonomy.ts — load taxonomy.json, query groups/items with per-group cache.

import type { IconItem, IconType, Taxonomy, TaxonomyGroup } from "./types";
import { getItemsByCategory } from "./data";
import taxonomy from "./taxonomy.json";

const TAX: Taxonomy = taxonomy as Taxonomy;
const groupItemsCache = new Map<string, IconItem[]>();

export function getGroups(type: IconType): TaxonomyGroup[] {
  return TAX[type] ?? [];
}

export function getGroup(type: IconType, groupId: string): TaxonomyGroup | null {
  return TAX[type]?.find((group) => group.id === groupId) ?? null;
}

export function getItemsInGroup(type: IconType, groupId: string): IconItem[] {
  const cacheKey = `${type}:${groupId}`;
  const cached = groupItemsCache.get(cacheKey);
  if (cached) return cached;

  const group = getGroup(type, groupId);
  if (!group) return [];
  const items = getItemsByCategory(type, group.categories);
  groupItemsCache.set(cacheKey, items);
  return items;
}

export function getDefaultGroup(type: IconType): string {
  return TAX[type]?.[0]?.id ?? "";
}
