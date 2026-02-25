use tauri::State;
use crate::db::DbState;
use crate::services::cartesia::{self, CartesiaConfig};

/// Speak text through Cartesia TTS and return audio file path
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
    // Get current agent message
    let message = super::agent::get_agent_message(state).await?;

    let api_key = std::env::var("CARTESIA_API_KEY")
        .map_err(|_| "CARTESIA_API_KEY not set.".to_string())?;

    let config = CartesiaConfig {
        api_key,
        ..Default::default()
    };

    cartesia::synthesize(&message.text, &config).await
}
