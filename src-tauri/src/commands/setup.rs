use std::path::PathBuf;
use std::process::Command;
#[cfg(unix)]
use std::os::unix::fs as unix_fs;
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

/// Auto-install whisper.cpp (download pre-built binary + model)
#[tauri::command]
pub async fn install_whisper_auto() -> Result<String, String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let whisper_dir = home.join("whisper.cpp");
    std::fs::create_dir_all(&whisper_dir).map_err(|e| format!("Cannot create dir: {}", e))?;

    // Step 1: Get the whisper-cli binary
    let bin_dir = whisper_dir.join("build").join("bin");
    std::fs::create_dir_all(&bin_dir).map_err(|e| format!("Cannot create bin dir: {}", e))?;
    let binary_path = bin_dir.join("whisper-cli");

    if !binary_path.exists() {
        // Strategy 1: Try brew install (fastest, handles updates)
        if try_brew_install_whisper(&binary_path) {
            log::info!("whisper-cli installed via Homebrew symlink");
        }
        // Strategy 2: Download pre-built binary from GitHub releases
        else if !binary_path.exists() {
            download_whisper_binary(&binary_path)?;
        }
    }

    // Step 2: Download model (large-v3-turbo for best PT-BR, fallback to base)
    let models_dir = whisper_dir.join("models");
    std::fs::create_dir_all(&models_dir).map_err(|e| format!("Cannot create models dir: {}", e))?;

    let turbo_path = models_dir.join("ggml-large-v3-turbo.bin");
    let base_path = models_dir.join("ggml-base.bin");

    let model_path = if turbo_path.exists() {
        turbo_path.clone()
    } else if base_path.exists() {
        base_path.clone()
    } else {
        // Download from HuggingFace (direct link, no script needed)
        let turbo_url = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin";
        log::info!("Downloading large-v3-turbo model (~1.6GB)...");

        let dl = Command::new("curl")
            .args(["-L", "-f", "--progress-bar", "-o"])
            .arg(&turbo_path)
            .arg(turbo_url)
            .output()
            .map_err(|e| format!("Model download failed: {}", e))?;

        if dl.status.success() && turbo_path.exists() {
            turbo_path.clone()
        } else {
            // Fallback to base model (~142MB, much faster download)
            log::warn!("large-v3-turbo download failed, trying base model...");
            let _ = std::fs::remove_file(&turbo_path); // cleanup partial download

            let base_url = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin";
            let dl_base = Command::new("curl")
                .args(["-L", "-f", "--progress-bar", "-o"])
                .arg(&base_path)
                .arg(base_url)
                .output()
                .map_err(|e| format!("Model download failed: {}", e))?;

            if !dl_base.status.success() {
                let _ = std::fs::remove_file(&base_path);
                return Err(
                    "Falha ao baixar modelo. Verifique sua conexão.\n\
                     Download manual: https://huggingface.co/ggerganov/whisper.cpp".to_string()
                );
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

/// Try to install whisper-cli via Homebrew and symlink to expected location
fn try_brew_install_whisper(target: &PathBuf) -> bool {
    // Check if brew is available
    let brew_check = Command::new("which").arg("brew").output();
    if brew_check.is_err() || !brew_check.as_ref().unwrap().status.success() {
        return false;
    }

    log::info!("Attempting whisper.cpp install via Homebrew...");

    let install = Command::new("brew")
        .args(["install", "whisper-cpp"])
        .output();

    if let Ok(out) = install {
        if out.status.success() {
            // Find the installed binary
            if let Ok(which) = Command::new("brew").args(["--prefix", "whisper-cpp"]).output() {
                let prefix = String::from_utf8_lossy(&which.stdout).trim().to_string();
                let brew_bin = PathBuf::from(&prefix).join("bin").join("whisper-cli");
                if brew_bin.exists() {
                    // Symlink to our expected location
                    let _ = unix_fs::symlink(&brew_bin, target);
                    return target.exists();
                }
            }
            // Fallback: check if whisper-cli is now in PATH
            if let Ok(which) = Command::new("which").arg("whisper-cli").output() {
                if which.status.success() {
                    let path = String::from_utf8_lossy(&which.stdout).trim().to_string();
                    let _ = unix_fs::symlink(&path, target);
                    return target.exists();
                }
            }
        }
    }

    false
}

/// Download pre-built whisper-cli binary from GitHub releases
fn download_whisper_binary(target: &PathBuf) -> Result<(), String> {
    log::info!("Downloading pre-built whisper-cli binary...");

    // Detect architecture
    let arch = if cfg!(target_arch = "aarch64") { "arm64" } else { "x86_64" };

    // Use GitHub API to find latest release with macOS binary
    // Direct download from latest known release (v1.7.5+)
    let release_url = format!(
        "https://github.com/ggerganov/whisper.cpp/releases/latest/download/whisper-cli-bin-macos-{}.zip",
        arch
    );

    let tmp_zip = target.parent().unwrap().join("whisper-cli.zip");

    // Download with curl (always available on macOS)
    let dl = Command::new("curl")
        .args(["-L", "-f", "-o"])
        .arg(&tmp_zip)
        .arg(&release_url)
        .output()
        .map_err(|e| format!("Download failed: {}", e))?;

    if !dl.status.success() {
        // Try alternative URL format
        let alt_url = format!(
            "https://github.com/ggerganov/whisper.cpp/releases/latest/download/whisper-v1.7.5-bin-macos-{}.zip",
            arch
        );
        let dl2 = Command::new("curl")
            .args(["-L", "-f", "-o"])
            .arg(&tmp_zip)
            .arg(&alt_url)
            .output()
            .map_err(|e| format!("Download failed: {}", e))?;

        if !dl2.status.success() {
            let _ = std::fs::remove_file(&tmp_zip);
            return Err(format!(
                "Não foi possível baixar o binário. Instale manualmente:\n\
                 brew install whisper-cpp\n\
                 ou visite: https://github.com/ggerganov/whisper.cpp/releases"
            ));
        }
    }

    // Unzip
    let unzip_dir = target.parent().unwrap().join("_unzip_tmp");
    let _ = std::fs::remove_dir_all(&unzip_dir);
    let unzip = Command::new("unzip")
        .args(["-o", "-q"])
        .arg(&tmp_zip)
        .arg("-d")
        .arg(&unzip_dir)
        .output()
        .map_err(|e| format!("Unzip failed: {}", e))?;

    let _ = std::fs::remove_file(&tmp_zip);

    if !unzip.status.success() {
        let _ = std::fs::remove_dir_all(&unzip_dir);
        return Err("Falha ao descompactar binário".to_string());
    }

    // Find the whisper-cli binary in unzipped contents
    let found = find_file_recursive(&unzip_dir, "whisper-cli");
    if let Some(bin) = found {
        std::fs::copy(&bin, target).map_err(|e| format!("Failed to copy binary: {}", e))?;
        // Make executable
        let _ = Command::new("chmod").arg("+x").arg(target).output();
        let _ = std::fs::remove_dir_all(&unzip_dir);
        return Ok(());
    }

    // Try "main" binary name (older releases)
    let found_main = find_file_recursive(&unzip_dir, "main");
    if let Some(bin) = found_main {
        std::fs::copy(&bin, target).map_err(|e| format!("Failed to copy binary: {}", e))?;
        let _ = Command::new("chmod").arg("+x").arg(target).output();
        let _ = std::fs::remove_dir_all(&unzip_dir);
        return Ok(());
    }

    let _ = std::fs::remove_dir_all(&unzip_dir);
    Err("Binário whisper-cli não encontrado no download".to_string())
}

/// Recursively find a file by name in a directory
fn find_file_recursive(dir: &PathBuf, name: &str) -> Option<PathBuf> {
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let file_name = entry.file_name().to_string_lossy().to_string();
            if file_name == name && path.is_file() {
                return Some(path);
            }
            if path.is_dir() {
                if let Some(found) = find_file_recursive(&path, name) {
                    return Some(found);
                }
            }
        }
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
