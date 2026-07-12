// hotkey.rs — register/unregister global shortcut.
// Default Alt+; (ARCHITECTURE ADR-05). Register fail → trả false rõ, KHÔNG silent fallback.

use tauri::{AppHandle, Runtime};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

/// Đổi hotkey runtime. Trả true nếu register thành công, false nếu fail.
pub fn register<R: Runtime>(app: &AppHandle<R>, accelerator: &str) -> Result<bool, String> {
    app.global_shortcut()
        .unregister_all()
        .map_err(|e| e.to_string())?;
    match app.global_shortcut().register(accelerator) {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

/// Unregister tất cả.
#[allow(dead_code)]
pub fn unregister_all<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    app.global_shortcut()
        .unregister_all()
        .map_err(|e| e.to_string())
}
