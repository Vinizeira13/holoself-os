use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct SystemStatus {
    pub version: String,
    pub db_connected: bool,
    pub gemini_configured: bool,
    pub voice_available: bool,
    pub timezone: String,
    pub uptime_seconds: u64,
}

/// Get current system status
#[tauri::command]
pub async fn get_system_status() -> Result<SystemStatus, String> {
    let gemini_configured = std::env::var("GEMINI_API_KEY").is_ok();

    Ok(SystemStatus {
        version: env!("CARGO_PKG_VERSION").to_string(),
        db_connected: true, // If we got here, DB is connected
        gemini_configured,
        voice_available: false, // TODO: Check whisper.cpp availability
        timezone: "WET".to_string(),
        uptime_seconds: 0, // TODO: Track uptime
    })
}
