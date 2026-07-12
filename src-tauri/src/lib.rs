// GlyphJet — spotlight launcher for emoji, symbols and kaomoji.
//
// Module layout:
//   commands.rs — Tauri IPC boundary (frontend calls only these)
//   hotkey.rs   — register/unregister global shortcut (Alt+; default)
//   window.rs   — spotlight window show/hide/position/focus
//   clipboard.rs — wrap clipboard-manager, CF_UNICODETEXT
//   tray.rs     — system tray icon + menu
//   settings.rs — tauri-plugin-store read/write

mod clipboard;
mod commands;
mod hotkey;
mod settings;
mod tray;
mod window;

use tauri::Manager;
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_global_shortcut::GlobalShortcutExt;

// Default hotkey: Alt+; (resolved at runtime, Win+; chỉ experimental option).
// Win+; is reserved by Windows at a low level and cannot be reliably
// overridden, so the default uses the safe Alt+; accelerator. Users can
// change it in Settings.
const DEFAULT_HOTKEY: &str = "Alt+;";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            let handle = app.handle().clone();

            // Single instance guard: instance thứ 2 → show popup của instance 1 rồi exit.
            #[cfg(desktop)]
            {
                let h = handle.clone();
                app.handle().plugin(tauri_plugin_single_instance::init(
                    move |_app, _argv, _cwd| {
                        if let Some(window) = h.get_webview_window("spotlight") {
                            let _ = window::show(&window);
                        }
                    },
                ))?;
            }

            // Tray icon + menu.
            tray::setup(&handle)?;

            // Load hoặc tạo settings store ở first-run. Lỗi settings không được
            // phép chặn frontend render; fallback default và log rõ để debug.
            let settings_loaded = settings::load_or_default(&handle);
            if let Err(error) = settings::save(&handle, &settings_loaded) {
                eprintln!("[glyphjet] WARN: cannot persist settings: {error}");
            }

            // Sync autostart state with settings on every app launch. The plugin
            // writes the registry Run key on Windows; settings is the source of
            // truth so a reinstall or manual registry edit stays consistent.
            let autostart_manager = handle.autolaunch();
            let desired = settings_loaded.launch_on_startup;
            let current = autostart_manager.is_enabled().unwrap_or(false);
            if desired && !current {
                if let Err(error) = autostart_manager.enable() {
                    eprintln!("[glyphjet] WARN: cannot enable autostart: {error}");
                }
            } else if !desired && current {
                if let Err(error) = autostart_manager.disable() {
                    eprintln!("[glyphjet] WARN: cannot disable autostart: {error}");
                }
            }

            // Register global shortcut default. Nếu fail, log warning + tiếp tục,
            // KHÔNG silent fallback, KHÔNG crash app (user có thể vào Settings đổi).
            let hotkey_handle = handle.clone();
            app.handle().plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_handler(move |_app, _shortcut, event| {
                        if event.state == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                            if let Some(window) = hotkey_handle.get_webview_window("spotlight") {
                                if window.is_visible().unwrap_or(false) {
                                    let _ = window::hide(&window);
                                } else {
                                    let _ = window::show(&window);
                                }
                            }
                        }
                    })
                    .build(),
            )?;

            // Register default hotkey sau khi plugin built. Bắt error rõ.
            match app.handle().global_shortcut().register(DEFAULT_HOTKEY) {
                Ok(_) => println!("[glyphjet] hotkey registered: {}", DEFAULT_HOTKEY),
                Err(e) => eprintln!(
                    "[glyphjet] WARN: failed to register default hotkey '{}': {} — user must change in Settings",
                    DEFAULT_HOTKEY, e
                ),
            };

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::copy_glyph,
            commands::show_popup,
            commands::hide_popup,
            commands::get_settings,
            commands::save_settings,
            commands::register_hotkey,
        ])
        .run(tauri::generate_context!())
        .expect("error while running GlyphJet");
}
