// settings-bridge.ts — wrap invoke('get_settings')/save_settings.

import { invoke } from "@tauri-apps/api/core";
import type { Settings } from "./types";

let cached: Settings | null = null;

const DEFAULT_SETTINGS: Settings = {
  hotkey: "Alt+;",
  launch_on_startup: true,
  popup_position: "center",
  last_type: "emoji",
  last_category: "smileys",
};

export async function getSettings(): Promise<Settings> {
  if (cached) return cached;
  try {
    cached = await invoke<Settings>("get_settings");
  } catch (error) {
    // Settings hỏng không được phép giết toàn bộ popup ở first-run.
    console.error("[glyphjet] cannot read settings; using defaults", error);
    cached = { ...DEFAULT_SETTINGS };
  }
  return cached;
}

export async function saveSettings(s: Settings): Promise<void> {
  await invoke("save_settings", { settings: s });
  cached = s;
}

export async function saveBrowseState(
  type: Settings["last_type"],
  category: string
): Promise<void> {
  const current = await getSettings();
  if (current.last_type === type && current.last_category === category) return;
  await saveSettings({ ...current, last_type: type, last_category: category });
}
