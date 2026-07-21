// window.rs — spotlight window show/hide/position/focus.
// Window "spotlight" config ở tauri.conf.json: borderless, transparent, always_on_top, skipTaskbar.

use tauri::{Emitter, Manager, Runtime, WebviewWindow};

/// Show spotlight + steal focus. Không destroy webview (giữ index/data warm).
pub fn show<R: Runtime>(window: &WebviewWindow<R>) -> Result<(), tauri::Error> {
    window.show()?;
    window.set_focus()?;
    // Native window focus events are unreliable on first show in WebView2, so
    // emit an explicit event the frontend can rely on to focus the search
    // input and clear any stale query.
    let _ = window.emit("glyphjet-shown", ());
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
