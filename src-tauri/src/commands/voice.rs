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

/// Save temporary audio data from frontend for Whisper processing
#[tauri::command]
pub async fn save_temp_audio(
    audio_data: Vec<u8>,
) -> Result<String, String> {
    let temp_dir = std::env::temp_dir().join("holoself");
    std::fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;
    let path = temp_dir.join(format!("voice_{}.webm", chrono::Utc::now().timestamp_millis()));
    std::fs::write(&path, &audio_data).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

/// Process voice command: transcribe + interpret via agent
#[tauri::command]
pub async fn process_voice_command(
    audio_path: String,
    state: State<'_, DbState>,
) -> Result<String, String> {
    // 1. Transcribe
    let transcript = tokio::task::spawn_blocking(move || {
        whisper::transcribe(&audio_path, Some("pt"))
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))??;

    if transcript.trim().is_empty() {
        return Ok("".to_string());
    }

    // 2. Store in agent memory
    let db = state.0.lock().map_err(|e| e.to_string())?;
    let _ = db.execute(
        "INSERT INTO agent_memory (key, value, timestamp) VALUES ('voice_input', ?1, ?2)",
        rusqlite::params![&transcript, &chrono::Utc::now().to_rfc3339()],
    );

    // 3. Return transcript (agent will process on frontend)
    Ok(transcript)
}

/// Check whisper.cpp availability
#[tauri::command]
pub async fn get_whisper_status() -> Result<whisper::WhisperStatus, String> {
    Ok(whisper::status())
}
