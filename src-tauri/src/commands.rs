// commands.rs — Tauri IPC boundary (frontend gọi vào đây duy nhất).
// Layering rule (STRUCTURE.md 5.1): delegate xuống clipboard/window/settings/hotkey.

use crate::{clipboard, hotkey, settings::Settings, window};
use tauri::{Manager, Runtime};

/// Copy glyph text thuần (CF_UNICODETEXT) vào clipboard.
#[tauri::command]
pub fn copy_glyph<R: Runtime>(app: tauri::AppHandle<R>, text: String) -> Result<(), String> {
    clipboard::set_text(&app, &text)
}

/// Show spotlight + steal focus.
#[tauri::command]
pub fn show_popup<R: Runtime>(app: tauri::AppHandle<R>) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("spotlight") {
        window::show(&window).map_err(|e| e.to_string())
    } else {
        Err("spotlight window not found".to_string())
    }
}

/// Hide spotlight (giữ webview sống).
#[tauri::command]
pub fn hide_popup<R: Runtime>(app: tauri::AppHandle<R>) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("spotlight") {
        window::hide(&window).map_err(|e| e.to_string())
    } else {
        Err("spotlight window not found".to_string())
    }
}

/// Đọc settings (hoặc default nếu first run).
#[tauri::command]
pub fn get_settings<R: Runtime>(app: tauri::AppHandle<R>) -> Result<Settings, String> {
    Ok(crate::settings::load_or_default(&app))
}

/// Persist settings atomic.
#[tauri::command]
pub fn save_settings<R: Runtime>(
    app: tauri::AppHandle<R>,
    settings: Settings,
) -> Result<(), String> {
    crate::settings::save(&app, &settings)
}

/// Đổi hotkey runtime. Trả true nếu register thành công, false nếu fail.
/// KHÔNG silent fallback (ADR-05) — frontend phải báo lỗi rõ cho user.
#[tauri::command]
pub fn register_hotkey<R: Runtime>(
    app: tauri::AppHandle<R>,
    accelerator: String,
) -> Result<bool, String> {
    hotkey::register(&app, &accelerator)
}
