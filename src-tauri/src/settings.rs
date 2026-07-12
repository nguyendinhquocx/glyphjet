// settings.rs — tauri-plugin-store read/write.
// Schema theo ARCHITECTURE 4.3: hotkey, launch_on_startup, popup_position, last_type, last_category.

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Runtime};
use tauri_plugin_store::StoreExt;

const STORE_FILE: &str = "settings.json";

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Settings {
    pub hotkey: String,
    pub launch_on_startup: bool,
    pub popup_position: String,
    pub last_type: String,
    pub last_category: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            hotkey: "Alt+;".to_string(),
            launch_on_startup: true,
            popup_position: "center".to_string(),
            last_type: "emoji".to_string(),
            last_category: "smileys".to_string(),
        }
    }
}

/// Load store nếu đã có hoặc tạo nó ở first-run. get_store() không dùng được ở
/// đây vì nó chỉ trả store đã mở, làm frontend trắng ngay lần chạy đầu.
pub fn load_or_default<R: Runtime>(app: &AppHandle<R>) -> Settings {
    let store = match app.store(STORE_FILE) {
        Ok(store) => store,
        Err(error) => {
            eprintln!("[glyphjet] WARN: cannot open settings store: {error}");
            return Settings::default();
        }
    };

    match store.get("settings") {
        Some(raw) => match serde_json::from_value::<Settings>(raw) {
            Ok(settings) => settings,
            Err(error) => {
                eprintln!("[glyphjet] WARN: invalid settings; using defaults: {error}");
                Settings::default()
            }
        },
        None => Settings::default(),
    }
}

/// Persist settings. Store mở/tạo atomically qua `store()`, không phụ thuộc
/// thứ tự startup của plugin hay một store cache có sẵn.
pub fn save<R: Runtime>(app: &AppHandle<R>, settings: &Settings) -> Result<(), String> {
    let store = app.store(STORE_FILE).map_err(|error| error.to_string())?;
    store.set(
        "settings",
        serde_json::to_value(settings).map_err(|error| error.to_string())?,
    );
    store.save().map_err(|error| error.to_string())
}
