// hotkey.rs — register/unregister global shortcut. Default Alt+;.
// Win+; is reserved by Windows at a low level and cannot be reliably
// overridden, so it is only offered as an experimental option.

use tauri::{AppHandle, Runtime};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

/// Change hotkey at runtime. Returns true if registered, false if the
/// accelerator is invalid or already taken.
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
