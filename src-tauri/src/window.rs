// window.rs — spotlight window show/hide/position/focus.
// Window "spotlight" config ở tauri.conf.json: borderless, transparent, always_on_top, skipTaskbar.

use tauri::{Manager, Runtime, WebviewWindow};

/// Show spotlight + steal focus. Không destroy webview (giữ index/data warm).
pub fn show<R: Runtime>(window: &WebviewWindow<R>) -> Result<(), tauri::Error> {
    window.show()?;
    window.set_focus()?;
    Ok(())
}

/// Hide spotlight (giữ webview sống).
pub fn hide<R: Runtime>(window: &WebviewWindow<R>) -> Result<(), tauri::Error> {
    window.hide()?;
    Ok(())
}

/// Toggle show/hide. Dùng cho tray click + hotkey.
#[allow(dead_code)]
pub fn toggle<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<(), tauri::Error> {
    if let Some(window) = app.get_webview_window("spotlight") {
        if window.is_visible().unwrap_or(false) {
            hide(&window)?;
        } else {
            show(&window)?;
        }
    }
    Ok(())
}
