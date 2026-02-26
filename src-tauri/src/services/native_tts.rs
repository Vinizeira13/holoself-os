use std::process::Command;

/// macOS native TTS via `say` command
/// Uses "Luciana" voice (PT-BR) — built-in, zero API keys needed
/// Returns WAV audio bytes that can be played by the frontend AudioContext

#[allow(dead_code)]
pub fn is_available() -> bool {
    Command::new("which")
        .arg("say")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Synthesize text to WAV audio bytes using macOS `say` command
/// Voice priority: Luciana (PT-BR) → Daniel (PT-PT) → system default
pub fn synthesize(text: &str) -> Result<Vec<u8>, String> {
    let temp_dir = std::env::temp_dir().join("holoself");
    std::fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;

    let aiff_path = temp_dir.join("tts_output.aiff");
    let wav_path = temp_dir.join("tts_output.wav");

    // Try PT-BR voice first, then PT-PT, then default
    let voices = ["Luciana", "Daniel", ""];
    let mut success = false;

    for voice in &voices {
        let mut cmd = Command::new("say");
        if !voice.is_empty() {
            cmd.arg("-v").arg(voice);
        }
        cmd.arg("-o").arg(&aiff_path).arg(text);

        if let Ok(output) = cmd.output() {
            if output.status.success() {
                success = true;
                break;
            }
        }
    }

    if !success {
        return Err("macOS say command failed with all voices".to_string());
    }

    // Convert AIFF → WAV using afconvert (built-in macOS)
    let convert = Command::new("afconvert")
        .arg("-f").arg("WAVE")
        .arg("-d").arg("LEI16@24000")  // 16-bit PCM, 24kHz (matches Cartesia)
        .arg(&aiff_path)
        .arg(&wav_path)
        .output()
        .map_err(|e| format!("afconvert failed: {}", e))?;

    if !convert.status.success() {
        let stderr = String::from_utf8_lossy(&convert.stderr);
        // Cleanup AIFF before returning error
        let _ = std::fs::remove_file(&aiff_path);
        return Err(format!("afconvert AIFF→WAV failed: {}", stderr));
    }

    let bytes = std::fs::read(&wav_path)
        .map_err(|e| format!("Failed to read WAV: {}", e))?;

    // Cleanup temp files
    let _ = std::fs::remove_file(&aiff_path);
    let _ = std::fs::remove_file(&wav_path);

    Ok(bytes)
}
