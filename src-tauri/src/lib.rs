// GlyphJet — spotlight launcher for emoji, symbols and kaomoji.
//
// Module layout follows .build/STRUCTURE.md:
//   commands.rs — Tauri IPC boundary (frontend gọi vào đây duy nhất)
//   hotkey.rs   — register/unregister global shortcut (Alt+; default)
//   window.rs   — spotlight window show/hide/position/focus
//   clipboard.rs — wrap clipboard-manager, CF_UNICODETEXT
//   tray.rs     — system tray icon + menu
//   settings.rs — tauri-plugin-store read/write (hotkey, startup, last_type, last_category)

mod clipboard;
mod commands;
mod hotkey;
mod settings;
mod tray;
mod window;

use tauri::Manager;
use tauri_plugin_global_shortcut::GlobalShortcutExt;

// Default hotkey: Alt+; (resolved at runtime, Win+; chỉ experimental option).
// Theo ARCHITECTURE ADR-05: Win+; register không reliably (Microsoft reserve),
// nên default dùng Alt+; an toàn, user có thể đổi trong Settings.
const DEFAULT_HOTKEY: &str = "Alt+;";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_store::Builder::default().build())
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
