use tauri::State;
use crate::db::DbState;
use crate::services::cartesia::{self, CartesiaConfig};
use crate::services::{native_tts, whisper};

/// Synthesize speech: tries Cartesia API first, falls back to macOS native TTS
async fn synthesize_speech(text: &str) -> Result<Vec<u8>, String> {
    // 1. Try Cartesia if API key is configured
    if let Ok(api_key) = std::env::var("CARTESIA_API_KEY") {
        if !api_key.is_empty() && api_key != "your_cartesia_key_here" {
            let config = CartesiaConfig {
                api_key,
                ..Default::default()
            };
            match cartesia::synthesize(text, &config).await {
                Ok(bytes) => return Ok(bytes),
                Err(e) => {
                    log::warn!("Cartesia TTS failed, trying native fallback: {}", e);
                }
            }
        }
    }

    // 2. Fallback: macOS native TTS (say command)
    let text_owned = text.to_string();
    tokio::task::spawn_blocking(move || {
        native_tts::synthesize(&text_owned)
    })
    .await
    .map_err(|e| format!("TTS task join error: {}", e))?
}

/// Speak text and return audio bytes
#[tauri::command]
pub async fn speak(
    text: String,
) -> Result<Vec<u8>, String> {
    synthesize_speech(&text).await
}

/// Speak the latest agent message
#[tauri::command]
pub async fn speak_agent_message(
    state: State<'_, DbState>,
) -> Result<Vec<u8>, String> {
    let message = super::agent::get_agent_message(state).await?;
    synthesize_speech(&message.text).await
}

/// Transcribe audio file using Whisper.cpp, then cleanup temp file
#[tauri::command]
pub async fn process_voice_input(
    audio_path: String,
    language: Option<String>,
) -> Result<String, String> {
    let path_clone = audio_path.clone();
    let result = tokio::task::spawn_blocking(move || {
        whisper::transcribe(&path_clone, language.as_deref())
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?;

    // Cleanup temp audio file after transcription
    let _ = std::fs::remove_file(&audio_path);

    result
}

/// Save temporary audio data from frontend for Whisper processing.
/// Accepts WebM (Opus) from MediaRecorder and converts to WAV via ffmpeg/afconvert.
#[tauri::command]
pub async fn save_temp_audio(
    audio_data: Vec<u8>,
) -> Result<String, String> {
    let temp_dir = std::env::temp_dir().join("holoself");
    std::fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;

    let ts = chrono::Utc::now().timestamp_millis();
    let webm_path = temp_dir.join(format!("voice_{}.webm", ts));
    let wav_path = temp_dir.join(format!("voice_{}.wav", ts));

    std::fs::write(&webm_path, &audio_data).map_err(|e| e.to_string())?;

    // Convert WebM → WAV (16kHz mono PCM16 — Whisper optimal format)
    let converted = convert_to_wav(&webm_path, &wav_path);

    // Cleanup source WebM
    let _ = std::fs::remove_file(&webm_path);

    match converted {
        Ok(()) => Ok(wav_path.to_string_lossy().to_string()),
        Err(e) => Err(format!("Falha na conversão de áudio: {}", e)),
    }
}

/// Convert audio file to WAV 16kHz mono PCM16
fn convert_to_wav(input: &std::path::Path, output: &std::path::Path) -> Result<(), String> {
    // Find ffmpeg: HoloSelf bundled → PATH
    let ffmpeg_bin = find_ffmpeg();

    let ffmpeg = std::process::Command::new(&ffmpeg_bin)
        .arg("-y")
        .arg("-i").arg(input)
        .arg("-ar").arg("16000")
        .arg("-ac").arg("1")
        .arg("-c:a").arg("pcm_s16le")
        .arg("-f").arg("wav")
        .arg(output)
        .stderr(std::process::Stdio::piped())
        .output();

    if let Ok(out) = ffmpeg {
        if out.status.success() {
            return Ok(());
        }
    }

    // Fallback: afconvert (macOS only — may not handle WebM but works for some formats)
    let afconvert = std::process::Command::new("afconvert")
        .arg("-f").arg("WAVE")
        .arg("-d").arg("LEI16@16000")
        .arg("-c").arg("1")
        .arg(input)
        .arg(output)
        .stderr(std::process::Stdio::piped())
        .output();

    if let Ok(out) = afconvert {
        if out.status.success() {
            return Ok(());
        }
        let stderr = String::from_utf8_lossy(&out.stderr);
        return Err(format!("afconvert failed: {}", stderr));
    }

    Err("Conversor de áudio não encontrado. Execute a instalação automática novamente nas configurações.".to_string())
}

/// Find ffmpeg binary: HoloSelf bundled → env var → PATH
fn find_ffmpeg() -> std::path::PathBuf {
    // 1. Env var from setup
    if let Ok(path) = std::env::var("HOLOSELF_FFMPEG_PATH") {
        let p = std::path::PathBuf::from(&path);
        if p.exists() { return p; }
    }
    // 2. Bundled in ~/.holoself/bin/
    if let Some(home) = dirs::home_dir() {
        let bundled = home.join(".holoself/bin/ffmpeg");
        if bundled.exists() { return bundled; }
    }
    // 3. System PATH
    std::path::PathBuf::from("ffmpeg")
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
