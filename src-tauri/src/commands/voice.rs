use tauri::State;
use crate::db::DbState;
use crate::services::cartesia::{self, CartesiaConfig};
use crate::services::whisper;

/// Speak text through Cartesia TTS and return audio bytes
#[tauri::command]
pub async fn speak(
    text: String,
) -> Result<Vec<u8>, String> {
    let api_key = std::env::var("CARTESIA_API_KEY")
        .map_err(|_| "CARTESIA_API_KEY not set.".to_string())?;

    let config = CartesiaConfig {
        api_key,
        ..Default::default()
    };

    cartesia::synthesize(&text, &config).await
}

/// Speak the latest agent message
#[tauri::command]
pub async fn speak_agent_message(
    state: State<'_, DbState>,
) -> Result<Vec<u8>, String> {
    let message = super::agent::get_agent_message(state).await?;

    let api_key = std::env::var("CARTESIA_API_KEY")
        .map_err(|_| "CARTESIA_API_KEY not set.".to_string())?;

    let config = CartesiaConfig {
        api_key,
        ..Default::default()
    };

    cartesia::synthesize(&message.text, &config).await
}

/// Transcribe audio file using Whisper.cpp
#[tauri::command]
pub async fn process_voice_input(
    audio_path: String,
    language: Option<String>,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        whisper::transcribe(&audio_path, language.as_deref())
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Check whisper.cpp availability
#[tauri::command]
pub async fn get_whisper_status() -> Result<whisper::WhisperStatus, String> {
    Ok(whisper::status())
}
