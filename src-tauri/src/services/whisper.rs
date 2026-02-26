use std::path::PathBuf;
use std::process::Command;
use anyhow::{Context, Result, bail};

/// Whisper.cpp STT Service
///
/// Uses whisper.cpp CLI binary for speech-to-text transcription.
/// The binary must be installed at one of the expected paths,
/// and a GGML model must be available.
///
/// Setup:
/// 1. Build whisper.cpp: `git clone https://github.com/ggerganov/whisper.cpp && cd whisper.cpp && make`
/// 2. Download model: `bash ./models/download-ggml-model.sh base`
/// 3. Set WHISPER_CPP_PATH env var to the binary location
/// 4. Set WHISPER_MODEL_PATH env var to the model file (.bin)

const DEFAULT_BINARY_NAMES: &[&str] = &["whisper-cli", "whisper", "main"];

/// Find the whisper.cpp binary
fn find_whisper_binary() -> Result<PathBuf> {
    // 1. Check env var
    if let Ok(path) = std::env::var("WHISPER_CPP_PATH") {
        let p = PathBuf::from(&path);
        if p.exists() {
            return Ok(p);
        }
    }

    // 2. Check common locations
    let home = dirs::home_dir().unwrap_or_default();
    let search_dirs = vec![
        home.join(".holoself/bin"),           // HoloSelf auto-installed
        home.join("whisper.cpp/build/bin"),   // cmake build output
        home.join("whisper.cpp"),             // legacy Makefile build
        home.join(".local/bin"),
        PathBuf::from("/usr/local/bin"),
        PathBuf::from("/opt/homebrew/bin"),
    ];

    for dir in &search_dirs {
        for name in DEFAULT_BINARY_NAMES {
            let candidate = dir.join(name);
            if candidate.exists() {
                return Ok(candidate);
            }
        }
    }

    // 3. Check PATH
    for name in DEFAULT_BINARY_NAMES {
        if let Ok(output) = Command::new("which").arg(name).output() {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !path.is_empty() {
                    return Ok(PathBuf::from(path));
                }
            }
        }
    }

    bail!(
        "Motor de transcrição não encontrado. Abra as configurações e execute a instalação automática."
    )
}

/// Find the GGML model file
fn find_model() -> Result<PathBuf> {
    // 1. Check env var
    if let Ok(path) = std::env::var("WHISPER_MODEL_PATH") {
        let p = PathBuf::from(&path);
        if p.exists() {
            return Ok(p);
        }
    }

    // 2. Check common locations
    let home = dirs::home_dir().unwrap_or_default();
    let model_names = &[
        "ggml-large-v3-turbo.bin",  // Best for PT-BR (~5% WER)
        "ggml-large-v3-turbo-q5_0.bin",
        "ggml-base.bin",
        "ggml-small.bin",
        "ggml-tiny.bin",
        "ggml-base.en.bin",
    ];

    let model_dirs = vec![
        home.join(".holoself/models"),       // HoloSelf auto-installed
        home.join("whisper.cpp/models"),
        home.join(".local/share/whisper"),
        home.join("Models"),
    ];

    for dir in &model_dirs {
        for name in model_names {
            let candidate = dir.join(name);
            if candidate.exists() {
                return Ok(candidate);
            }
        }
    }

    bail!(
        "Modelo de voz não encontrado. Abra as configurações e execute a instalação automática."
    )
}

/// Transcribe an audio file using whisper.cpp
///
/// Accepts WAV (16-bit, 16kHz mono preferred) or any ffmpeg-compatible format.
/// Returns the transcribed text.
pub fn transcribe(audio_path: &str, language: Option<&str>) -> Result<String> {
    let binary = find_whisper_binary()?;
    let model = find_model()?;
    let lang = language.unwrap_or("pt"); // Default to Portuguese

    let audio = PathBuf::from(audio_path);
    if !audio.exists() {
        bail!("Audio file not found: {}", audio_path);
    }

    // Run whisper.cpp CLI (optimized for Apple Silicon)
    let output = Command::new(&binary)
        .arg("-m").arg(&model)
        .arg("-f").arg(&audio)
        .arg("-l").arg(lang)
        .arg("--no-timestamps")
        .arg("-nt")         // No timestamps in output
        .arg("-np")         // No progress
        .arg("-t").arg("4") // Use 4 threads (Apple Silicon optimized)
        .arg("--translate").arg("false") // Never translate, keep original language
        .output()
        .with_context(|| format!("Failed to run whisper.cpp at {:?}", binary))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        bail!("Whisper.cpp error: {}", stderr);
    }

    let text = String::from_utf8_lossy(&output.stdout)
        .trim()
        .to_string();

    Ok(text)
}

/// Check if whisper.cpp is available
#[allow(dead_code)]
pub fn is_available() -> bool {
    find_whisper_binary().is_ok() && find_model().is_ok()
}

/// Get whisper.cpp status info
pub fn status() -> WhisperStatus {
    let binary = find_whisper_binary();
    let model = find_model();

    WhisperStatus {
        binary_found: binary.is_ok(),
        binary_path: binary.ok().map(|p| p.to_string_lossy().to_string()),
        model_found: model.is_ok(),
        model_path: model.ok().map(|p| p.to_string_lossy().to_string()),
    }
}

#[derive(Debug, serde::Serialize)]
pub struct WhisperStatus {
    pub binary_found: bool,
    pub binary_path: Option<String>,
    pub model_found: bool,
    pub model_path: Option<String>,
}
