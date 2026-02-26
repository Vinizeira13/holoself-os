use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub gemini_api_key: String,
    pub cartesia_api_key: String,
    pub cartesia_voice_id: String,
    pub skin_type: u8,
    pub latitude: f64,
    pub longitude: f64,
    pub timezone: String,
    pub sleep_anchor_hour: u8,  // Hour to start sleep protocol (default: 2 = 02:00)
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            gemini_api_key: String::new(),
            cartesia_api_key: String::new(),
            cartesia_voice_id: "a0e99841-438c-4a64-b679-ae501e7d6091".to_string(),
            skin_type: 4,
            latitude: 38.7223,
            longitude: -9.1393,
            timezone: "WET".to_string(),
            sleep_anchor_hour: 2,
        }
    }
}

fn settings_path() -> Result<PathBuf, String> {
    let config_dir = dirs::config_dir()
        .ok_or("Cannot determine config directory")?;
    let app_dir = config_dir.join("com.holoself.os");
    std::fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Failed to create config dir: {}", e))?;
    Ok(app_dir.join("settings.json"))
}

/// Load settings from disk, or return defaults
#[tauri::command]
pub async fn get_settings() -> Result<AppSettings, String> {
    let path = settings_path()?;

    if path.exists() {
        let data = std::fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read settings: {}", e))?;
        let mut settings: AppSettings = serde_json::from_str(&data)
            .map_err(|e| format!("Failed to parse settings: {}", e))?;

        // Override with env vars if set (env vars take priority)
        if let Ok(key) = std::env::var("GEMINI_API_KEY") {
            if !key.is_empty() { settings.gemini_api_key = key; }
        }
        if let Ok(key) = std::env::var("CARTESIA_API_KEY") {
            if !key.is_empty() { settings.cartesia_api_key = key; }
        }

        Ok(settings)
    } else {
        let mut settings = AppSettings::default();
        // Check env vars
        if let Ok(key) = std::env::var("GEMINI_API_KEY") {
            settings.gemini_api_key = key;
        }
        if let Ok(key) = std::env::var("CARTESIA_API_KEY") {
            settings.cartesia_api_key = key;
        }
        Ok(settings)
    }
}

/// Save settings to disk
#[tauri::command]
pub async fn save_settings(settings: AppSettings) -> Result<(), String> {
    let path = settings_path()?;
    let data = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    std::fs::write(&path, data)
        .map_err(|e| format!("Failed to write settings: {}", e))?;
    Ok(())
}
