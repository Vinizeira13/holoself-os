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

/// Full dependency health check — call on app startup
/// Returns which components are OK and which need repair
#[derive(serde::Serialize)]
pub struct DependencyHealth {
    pub whisper_binary: bool,
    pub whisper_model: bool,
    pub ffmpeg: bool,
    pub gemini_key: bool,
    pub needs_repair: bool,
    pub message: String,
}

#[tauri::command]
pub async fn check_dependencies() -> Result<DependencyHealth, String> {
    let home = dirs::home_dir().unwrap_or_default();
    let holoself_dir = home.join(".holoself");

    let whisper_binary = find_whisper_binary().is_some();
    let whisper_model = find_whisper_model().is_some();

    // Check ffmpeg: bundled → PATH
    let ffmpeg = holoself_dir.join("bin/ffmpeg").exists()
        || Command::new("which").arg("ffmpeg").output()
            .map(|o| o.status.success()).unwrap_or(false);

    let gemini_key = std::env::var("GEMINI_API_KEY")
        .map(|k| !k.is_empty() && k != "your_gemini_api_key_here")
        .unwrap_or(false);

    let needs_repair = !whisper_binary || !whisper_model || !ffmpeg;

    let message = if !needs_repair {
        "Todos os componentes operacionais.".to_string()
    } else {
        let mut missing = Vec::new();
        if !whisper_binary { missing.push("motor de transcrição"); }
        if !whisper_model { missing.push("modelo de voz"); }
        if !ffmpeg { missing.push("conversor de áudio"); }
        format!("Componentes em falta: {}. Clique em reparar para instalar automaticamente.", missing.join(", "))
    };

    Ok(DependencyHealth {
        whisper_binary,
        whisper_model,
        ffmpeg,
        gemini_key,
        needs_repair,
        message,
    })
}

/// Repair missing dependencies — reinstalls only what's missing
#[tauri::command]
pub async fn repair_dependencies() -> Result<String, String> {
    // Just call the same install function — it skips what's already installed
    install_whisper_auto().await
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

/// Auto-install whisper.cpp + ffmpeg (download pre-built binaries + model)
/// No compilation, no terminal, no dev tools needed.
#[tauri::command]
pub async fn install_whisper_auto() -> Result<String, String> {
    let home = dirs::home_dir().ok_or("Não foi possível encontrar a pasta do utilizador")?;
    let holoself_dir = home.join(".holoself");
    std::fs::create_dir_all(&holoself_dir).map_err(|e| format!("Erro ao criar pasta: {}", e))?;

    let bin_dir = holoself_dir.join("bin");
    std::fs::create_dir_all(&bin_dir).map_err(|e| format!("Erro ao criar pasta: {}", e))?;

    // === Step 1: whisper-cli binary ===
    let whisper_path = bin_dir.join("whisper-cli");
    if !whisper_path.exists() {
        // Try brew first (if user has it), else download pre-built
        if !try_brew_install_whisper(&whisper_path) {
            download_whisper_binary(&whisper_path)?;
        }
    }

    // === Step 2: ffmpeg binary (needed for audio conversion) ===
    let ffmpeg_path = bin_dir.join("ffmpeg");
    if !ffmpeg_path.exists() {
        // Check if ffmpeg already in PATH
        let in_path = Command::new("which").arg("ffmpeg").output()
            .map(|o| o.status.success()).unwrap_or(false);
        if !in_path {
            download_ffmpeg_binary(&ffmpeg_path)?;
        }
    }

    // === Step 3: Whisper model ===
    let models_dir = holoself_dir.join("models");
    std::fs::create_dir_all(&models_dir).map_err(|e| format!("Erro ao criar pasta: {}", e))?;

    let turbo_path = models_dir.join("ggml-large-v3-turbo.bin");
    let base_path = models_dir.join("ggml-base.bin");

    let model_path = if turbo_path.exists() {
        turbo_path.clone()
    } else if base_path.exists() {
        base_path.clone()
    } else {
        // Download from HuggingFace (direct link)
        let turbo_url = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin";
        log::info!("Downloading large-v3-turbo model (~1.6GB)...");

        let dl = Command::new("curl")
            .args(["-L", "-f", "--progress-bar", "-o"])
            .arg(&turbo_path)
            .arg(turbo_url)
            .output()
            .map_err(|e| format!("Falha no download: {}", e))?;

        if dl.status.success() && turbo_path.exists() {
            turbo_path.clone()
        } else {
            // Fallback: base model (~142MB, much faster)
            log::warn!("large-v3-turbo failed, trying base model...");
            let _ = std::fs::remove_file(&turbo_path);

            let base_url = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin";
            let dl_base = Command::new("curl")
                .args(["-L", "-f", "--progress-bar", "-o"])
                .arg(&base_path)
                .arg(base_url)
                .output()
                .map_err(|e| format!("Falha no download: {}", e))?;

            if !dl_base.status.success() {
                let _ = std::fs::remove_file(&base_path);
                return Err(
                    "Não foi possível baixar o modelo de voz. Verifique sua conexão à internet e tente novamente.".to_string()
                );
            }
            base_path.clone()
        }
    };

    // Set env vars for this session
    std::env::set_var("WHISPER_CPP_PATH", &whisper_path);
    std::env::set_var("WHISPER_MODEL_PATH", &model_path);
    if ffmpeg_path.exists() {
        std::env::set_var("HOLOSELF_FFMPEG_PATH", &ffmpeg_path);
    }

    Ok("Componentes de voz instalados com sucesso!".to_string())
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

    // Check HoloSelf directory first, then legacy whisper.cpp
    for dir_name in &[".holoself", "whisper.cpp"] {
        let dir = home.join(dir_name);
        if let Some(bin) = find_whisper_binary_in(&dir) {
            return Some(bin);
        }
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
    // Check bin/ directory (HoloSelf standard location)
    let bin_dir_names = ["bin", "build/bin"];
    for bd in &bin_dir_names {
        for name in &["whisper-cli", "main"] {
            let bin = dir.join(bd).join(name);
            if bin.exists() { return Some(bin); }
        }
    }

    // Root-level binaries (legacy)
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

    let arch = if cfg!(target_arch = "aarch64") { "arm64" } else { "x86_64" };

    // Try multiple URL patterns (GitHub release naming varies between versions)
    let urls = vec![
        format!("https://github.com/ggerganov/whisper.cpp/releases/latest/download/whisper-cli-bin-macos-{}.zip", arch),
        format!("https://github.com/ggerganov/whisper.cpp/releases/latest/download/whisper-v1.7.5-bin-macos-{}.zip", arch),
    ];

    let tmp_zip = target.parent()
        .ok_or("Caminho de instalação inválido")?
        .join("whisper-cli.zip");

    let mut downloaded = false;
    for url in &urls {
        let dl = Command::new("curl")
            .args(["-L", "-f", "-s", "-o"])
            .arg(&tmp_zip)
            .arg(url)
            .output();

        if let Ok(out) = dl {
            if out.status.success() && tmp_zip.exists() {
                downloaded = true;
                break;
            }
        }
    }

    if !downloaded {
        let _ = std::fs::remove_file(&tmp_zip);
        return Err(
            "Não foi possível baixar o motor de transcrição. Verifique sua conexão à internet e tente novamente.".to_string()
        );
    }

    // Extract
    extract_binary_from_zip(&tmp_zip, target, &["whisper-cli", "main"])?;
    Ok(())
}

/// Download static ffmpeg binary (needed for audio format conversion)
fn download_ffmpeg_binary(target: &PathBuf) -> Result<(), String> {
    log::info!("Downloading static ffmpeg binary...");

    let tmp_zip = target.parent()
        .ok_or("Caminho de instalação inválido")?
        .join("ffmpeg.zip");

    // evermeet.cx hosts reliable macOS static builds
    let url = "https://evermeet.cx/ffmpeg/getrelease/zip";
    let dl = Command::new("curl")
        .args(["-L", "-f", "-s", "-o"])
        .arg(&tmp_zip)
        .arg(url)
        .output()
        .map_err(|e| format!("Download ffmpeg falhou: {}", e))?;

    if !dl.status.success() || !tmp_zip.exists() {
        let _ = std::fs::remove_file(&tmp_zip);
        // Not critical — afconvert (built-in macOS) can handle some formats
        log::warn!("ffmpeg download failed, will rely on afconvert fallback");
        return Ok(());
    }

    extract_binary_from_zip(&tmp_zip, target, &["ffmpeg"])?;
    Ok(())
}

/// Extract a named binary from a zip file into target path
fn extract_binary_from_zip(zip_path: &PathBuf, target: &PathBuf, names: &[&str]) -> Result<(), String> {
    let unzip_dir = target.parent()
        .ok_or("Caminho de descompactação inválido")?
        .join("_unzip_tmp");
    let _ = std::fs::remove_dir_all(&unzip_dir);

    let unzip = Command::new("unzip")
        .args(["-o", "-q"])
        .arg(zip_path)
        .arg("-d")
        .arg(&unzip_dir)
        .output()
        .map_err(|e| format!("Erro ao descompactar: {}", e))?;

    let _ = std::fs::remove_file(zip_path);

    if !unzip.status.success() {
        let _ = std::fs::remove_dir_all(&unzip_dir);
        return Err("Erro ao descompactar ficheiro".to_string());
    }

    for name in names {
        if let Some(bin) = find_file_recursive(&unzip_dir, name) {
            std::fs::copy(&bin, target).map_err(|e| format!("Erro ao copiar: {}", e))?;
            let _ = Command::new("chmod").arg("+x").arg(target).output();
            let _ = std::fs::remove_dir_all(&unzip_dir);
            return Ok(());
        }
    }

    let _ = std::fs::remove_dir_all(&unzip_dir);
    Err("Ficheiro não encontrado no download".to_string())
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
        home.join(".holoself/models"),
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
