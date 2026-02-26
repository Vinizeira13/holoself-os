use std::path::PathBuf;
use std::process::Command;
use tauri::Manager;

#[derive(serde::Serialize)]
pub struct SetupStatus {
    pub gemini_key: bool,
    pub cartesia_key: bool,
    pub whisper_binary: bool,
    pub whisper_model: bool,
    pub camera_permission: bool,
    pub mic_permission: bool,
}

/// Check which components are configured
#[tauri::command]
pub async fn check_setup_status() -> Result<SetupStatus, String> {
    let gemini_key = std::env::var("GEMINI_API_KEY")
        .map(|k| !k.is_empty() && k != "your_gemini_api_key_here")
        .unwrap_or(false);

    let cartesia_key = std::env::var("CARTESIA_API_KEY")
        .map(|k| !k.is_empty() && k != "your_cartesia_key_here")
        .unwrap_or(false);

    let whisper_binary = find_whisper_binary().is_some();
    let whisper_model = find_whisper_model().is_some();

    // Camera/mic permission can only be tested from frontend (WebRTC)
    // We return true optimistically here; the frontend verifies
    Ok(SetupStatus {
        gemini_key,
        cartesia_key,
        whisper_binary,
        whisper_model,
        camera_permission: true, // Checked on frontend
        mic_permission: true,    // Checked on frontend
    })
}

/// Save API keys to .env file in the app data directory
#[tauri::command]
pub async fn save_api_keys(
    gemini_key: Option<String>,
    cartesia_key: Option<String>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    // Get app data dir
    let config_dir = app_handle
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;

    let env_path = config_dir.join(".env");

    // Read existing or start fresh
    let mut env_content = std::fs::read_to_string(&env_path).unwrap_or_default();

    // Update/add Gemini key
    if let Some(key) = &gemini_key {
        if !key.is_empty() {
            update_env_var(&mut env_content, "GEMINI_API_KEY", key);
            std::env::set_var("GEMINI_API_KEY", key);
        }
    }

    // Update/add Cartesia key
    if let Some(key) = &cartesia_key {
        if !key.is_empty() {
            update_env_var(&mut env_content, "CARTESIA_API_KEY", key);
            std::env::set_var("CARTESIA_API_KEY", key);
        }
    }

    std::fs::write(&env_path, &env_content).map_err(|e| e.to_string())?;

    // Also write to src-tauri/.env for dev mode
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            // Try to find src-tauri dir
            let dev_env = parent
                .ancestors()
                .find(|p| p.join("src-tauri").exists())
                .map(|p| p.join("src-tauri/.env"));

            if let Some(dev_path) = dev_env {
                let _ = std::fs::write(&dev_path, &env_content);
            }
        }
    }

    Ok(())
}

/// Auto-install whisper.cpp (clone + compile + download model)
#[tauri::command]
pub async fn install_whisper_auto() -> Result<String, String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let whisper_dir = home.join("whisper.cpp");

    // Step 1: Clone if not exists
    if !whisper_dir.exists() {
        let output = Command::new("git")
            .args(["clone", "--depth", "1", "https://github.com/ggerganov/whisper.cpp.git"])
            .arg(&whisper_dir)
            .output()
            .map_err(|e| format!("git clone failed: {}", e))?;

        if !output.status.success() {
            return Err(format!(
                "git clone failed: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }
    }

    // Step 2: Compile
    let make_output = Command::new("make")
        .current_dir(&whisper_dir)
        .output()
        .map_err(|e| format!("make failed: {}", e))?;

    if !make_output.status.success() {
        return Err(format!(
            "Compilation failed: {}",
            String::from_utf8_lossy(&make_output.stderr).chars().take(500).collect::<String>()
        ));
    }

    // Step 3: Download base model
    let model_path = whisper_dir.join("models/ggml-base.bin");
    if !model_path.exists() {
        let script = whisper_dir.join("models/download-ggml-model.sh");
        if script.exists() {
            let dl_output = Command::new("bash")
                .arg(&script)
                .arg("base")
                .current_dir(&whisper_dir)
                .output()
                .map_err(|e| format!("Model download failed: {}", e))?;

            if !dl_output.status.success() {
                return Err(format!(
                    "Model download failed: {}",
                    String::from_utf8_lossy(&dl_output.stderr).chars().take(500).collect::<String>()
                ));
            }
        } else {
            return Err("Model download script not found".to_string());
        }
    }

    // Set env vars for this session
    let binary = find_whisper_binary_in(&whisper_dir);
    if let Some(bin) = &binary {
        std::env::set_var("WHISPER_CPP_PATH", bin);
    }
    std::env::set_var("WHISPER_MODEL_PATH", &model_path);

    Ok(format!(
        "Whisper.cpp installed at {}",
        whisper_dir.display()
    ))
}

// === Helpers ===

fn update_env_var(content: &mut String, key: &str, value: &str) {
    let prefix = format!("{}=", key);
    let new_line = format!("{}={}", key, value);

    if let Some(pos) = content.find(&prefix) {
        // Replace existing line
        let end = content[pos..].find('\n').map(|i| pos + i).unwrap_or(content.len());
        content.replace_range(pos..end, &new_line);
    } else {
        // Append
        if !content.is_empty() && !content.ends_with('\n') {
            content.push('\n');
        }
        content.push_str(&new_line);
        content.push('\n');
    }
}

fn find_whisper_binary() -> Option<PathBuf> {
    // Check env var first
    if let Ok(path) = std::env::var("WHISPER_CPP_PATH") {
        let p = PathBuf::from(&path);
        if p.exists() { return Some(p); }
    }

    let home = dirs::home_dir()?;
    let whisper_dir = home.join("whisper.cpp");

    // Check common locations
    if let Some(bin) = find_whisper_binary_in(&whisper_dir) {
        return Some(bin);
    }

    // Check PATH
    for name in &["whisper-cli", "whisper", "main"] {
        if let Ok(output) = Command::new("which").arg(name).output() {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !path.is_empty() {
                    return Some(PathBuf::from(path));
                }
            }
        }
    }

    None
}

fn find_whisper_binary_in(dir: &PathBuf) -> Option<PathBuf> {
    for name in &["whisper-cli", "main"] {
        let bin = dir.join(name);
        if bin.exists() { return Some(bin); }
    }
    None
}

fn find_whisper_model() -> Option<PathBuf> {
    if let Ok(path) = std::env::var("WHISPER_MODEL_PATH") {
        let p = PathBuf::from(&path);
        if p.exists() { return Some(p); }
    }

    let home = dirs::home_dir()?;

    // Search common model locations
    let dirs_to_check = [
        home.join("whisper.cpp/models"),
        home.join(".local/share/whisper"),
        home.join("Models"),
    ];

    for dir in &dirs_to_check {
        if dir.exists() {
            if let Ok(entries) = std::fs::read_dir(dir) {
                for entry in entries.flatten() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if name.starts_with("ggml-") && name.ends_with(".bin") {
                        return Some(entry.path());
                    }
                }
            }
        }
    }

    None
}
