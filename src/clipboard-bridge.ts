// clipboard-bridge.ts — wrap invoke('copy_glyph').
// Layering rule: ui/* KHÔNG gọi invoke trực tiếp, phải qua bridge này.

import { invoke } from "@tauri-apps/api/core";

export async function copyGlyph(text: string): Promise<void> {
  await invoke("copy_glyph", { text });
}
