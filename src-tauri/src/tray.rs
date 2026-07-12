// tray.rs — system tray icon + menu.

use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager, Runtime,
};
use tauri_plugin_autostart::ManagerExt;

pub fn setup<R: Runtime>(app: &AppHandle<R>) -> Result<(), tauri::Error> {
    let open_item = MenuItem::with_id(app, "open", "Open GlyphJet\tAlt+;", true, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let startup_item = CheckMenuItem::with_id(
        app,
        "startup",
        "Launch on startup",
        true,
        autostart_enabled(app),
        None::<&str>,
    )?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let exit_item = MenuItem::with_id(app, "exit", "Exit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open_item, &sep1, &startup_item, &sep2, &exit_item])?;

    let app_handle = app.clone();
    let startup_toggle = startup_item.clone();
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
            "startup" => {
                let manager = app.autolaunch();
                let new_state = if manager.is_enabled().unwrap_or(false) {
                    let _ = manager.disable();
                    false
                } else {
                    let _ = manager.enable();
                    true
                };
                let _ = startup_toggle.set_checked(new_state);

                // Persist toggle so the next app launch re-syncs the registry
                // from settings (single source of truth).
                let mut settings = crate::settings::load_or_default(app);
                settings.launch_on_startup = new_state;
                if let Err(error) = crate::settings::save(app, &settings) {
                    eprintln!("[glyphjet] WARN: cannot save launch_on_startup: {error}");
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

fn autostart_enabled<R: Runtime>(app: &AppHandle<R>) -> bool {
    app.autolaunch().is_enabled().unwrap_or(false)
}
