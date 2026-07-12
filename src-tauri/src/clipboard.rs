// clipboard.rs — wrap tauri-plugin-clipboard-manager.
// Chỉ set CF_UNICODETEXT (glyph text thuần). KHÔNG set HTML format (ARCHITECTURE B5).

use tauri::{AppHandle, Runtime};
use tauri_plugin_clipboard_manager::ClipboardExt;

pub fn set_text<R: Runtime>(app: &AppHandle<R>, text: &str) -> Result<(), String> {
    app.clipboard().write_text(text).map_err(|e| e.to_string())
}
