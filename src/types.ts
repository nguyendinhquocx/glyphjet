// types.ts — TypeScript types cho GlyphJet frontend.
// IconItem schema theo data.json + search.ts SearchItem (line 14 có cp?).

export type IconType = "emoji" | "symbol" | "kaomoji";

export interface IconItem {
  t: string; // text glyph (copy target)
  y: IconType; // type
  c: string; // category
  s: string; // subcategory
  n: string; // display name
  g: string; // tags (searchable)
  cp?: string; // codepoint, optional — có ở symbol items
}

export interface TaxonomyGroup {
  id: string;
  label: string;
  categories: string[];
}

export type Taxonomy = Record<IconType, TaxonomyGroup[]>;

export interface Settings {
  hotkey: string;
  launch_on_startup: boolean;
  popup_position: string;
  last_type: IconType;
  last_category: string;
}

export type UIMode = "browse" | "search";

export interface UIState {
  mode: UIMode;
  query: string;
  currentType: IconType;
  currentGroup: string; // taxonomy group id
  results: IconItem[];
  isLoading: boolean;
}
