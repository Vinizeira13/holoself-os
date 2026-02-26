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

    Ok(())
}

/// Auto-install whisper.cpp (clone + compile + download model)
#[tauri::command]
pub async fn install_whisper_auto() -> Result<String, String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let whisper_dir = home.join("whisper.cpp");

    // Step 0: Ensure cmake is available (required by whisper.cpp build system)
    ensure_cmake_installed()?;

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

    // Step 2: Compile using cmake (whisper.cpp's current build system)
    let build_dir = whisper_dir.join("build");
    std::fs::create_dir_all(&build_dir).map_err(|e| format!("Cannot create build dir: {}", e))?;

    // Configure with cmake
    let cmake_config = Command::new("cmake")
        .args(["..", "-DCMAKE_BUILD_TYPE=Release"])
        .current_dir(&build_dir)
        .output()
        .map_err(|e| format!("cmake configure failed: {}", e))?;

    if !cmake_config.status.success() {
        return Err(format!(
            "cmake configure failed: {}",
            String::from_utf8_lossy(&cmake_config.stderr).chars().take(500).collect::<String>()
        ));
    }

    // Build
    let cmake_build = Command::new("cmake")
        .args(["--build", ".", "--config", "Release", "-j"])
        .current_dir(&build_dir)
        .output()
        .map_err(|e| format!("cmake build failed: {}", e))?;

    if !cmake_build.status.success() {
        return Err(format!(
            "Compilation failed: {}",
            String::from_utf8_lossy(&cmake_build.stderr).chars().take(500).collect::<String>()
        ));
    }

    // Step 3: Download large-v3-turbo model (best PT-BR quality, 1.6GB)
    // Falls back to base model if turbo fails (e.g. disk space)
    let turbo_path = whisper_dir.join("models/ggml-large-v3-turbo.bin");
    let base_path = whisper_dir.join("models/ggml-base.bin");

    let model_path = if turbo_path.exists() {
        turbo_path.clone()
    } else if base_path.exists() {
        base_path.clone()
    } else {
        // Try turbo first, fallback to base
        let script = whisper_dir.join("models/download-ggml-model.sh");
        if !script.exists() {
            return Err("Model download script not found".to_string());
        }

        let dl_output = Command::new("bash")
            .arg(&script)
            .arg("large-v3-turbo")
            .current_dir(&whisper_dir)
            .output()
            .map_err(|e| format!("Model download failed: {}", e))?;

        if dl_output.status.success() && turbo_path.exists() {
            turbo_path.clone()
        } else {
            // Fallback to base (smaller, faster download)
            log::warn!("large-v3-turbo download failed, trying base model");
            let dl_base = Command::new("bash")
                .arg(&script)
                .arg("base")
                .current_dir(&whisper_dir)
                .output()
                .map_err(|e| format!("Base model download failed: {}", e))?;

            if !dl_base.status.success() {
                return Err(format!(
                    "Model download failed: {}",
                    String::from_utf8_lossy(&dl_base.stderr).chars().take(500).collect::<String>()
                ));
            }
            base_path.clone()
        }
    };

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
    // Check cmake build output first (build/bin/whisper-cli)
    let cmake_bins = [
        dir.join("build/bin/whisper-cli"),
        dir.join("build/bin/main"),
    ];
    for bin in &cmake_bins {
        if bin.exists() { return Some(bin.clone()); }
    }

    // Legacy: root-level binaries (old Makefile build)
    for name in &["whisper-cli", "main"] {
        let bin = dir.join(name);
        if bin.exists() { return Some(bin); }
    }
    None
}

/// Ensure cmake is installed, installing via Homebrew if needed (macOS)
fn ensure_cmake_installed() -> Result<(), String> {
    // Check if cmake already available
    if let Ok(output) = Command::new("cmake").arg("--version").output() {
        if output.status.success() {
            return Ok(());
        }
    }

    // Try installing via Homebrew (macOS)
    log::info!("cmake not found, attempting install via Homebrew...");

    // Check if brew is available
    let brew_check = Command::new("which").arg("brew").output();
    if brew_check.is_err() || !brew_check.unwrap().status.success() {
        return Err(
            "cmake não encontrado e Homebrew não está instalado.\n\
             Instale manualmente:\n\
             1. Instalar Homebrew: /bin/bash -c \"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"\n\
             2. brew install cmake\n\
             3. Tente novamente".to_string()
        );
    }

    let install = Command::new("brew")
        .args(["install", "cmake"])
        .output()
        .map_err(|e| format!("brew install cmake failed: {}", e))?;

    if !install.status.success() {
        return Err(format!(
            "brew install cmake falhou: {}",
            String::from_utf8_lossy(&install.stderr).chars().take(300).collect::<String>()
        ));
    }

    log::info!("cmake installed successfully via Homebrew");
    Ok(())
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
