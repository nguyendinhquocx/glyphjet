// tray.rs — system tray icon + menu (Open / Settings / Exit).

use tauri::{
    menu::{Menu, MenuItem},
    AppHandle, Manager, Runtime,
};
use tauri::tray::TrayIconBuilder;

pub fn setup<R: Runtime>(app: &AppHandle<R>) -> Result<(), tauri::Error> {
    let open_item = MenuItem::with_id(app, "open", "Open GlyphJet", true, None::<&str>)?;
    let settings_item = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
    let exit_item = MenuItem::with_id(app, "exit", "Exit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open_item, &settings_item, &exit_item])?;

    let app_handle = app.clone();
    TrayIconBuilder::with_id("glyphjet-tray")
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("GlyphJet — Alt+;")
        .menu(&menu)
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "open" => {
                if let Some(window) = app.get_webview_window("spotlight") {
                    let _ = crate::window::show(&window);
                }
            }
            "settings" => {
                // TODO Phase 5: mở Settings window.
                if let Some(window) = app.get_webview_window("spotlight") {
                    let _ = crate::window::show(&window);
                }
            }
            "exit" => {
                app_handle.exit(0);
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}
