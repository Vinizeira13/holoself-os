// HoloSelf OS — Core Library
// Privacy-first AI health agent with holographic HUD

mod commands;
mod db;
mod services;

use tauri::Manager;

/// Initialize the HoloSelf OS application
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            // Load .env from app config dir (saved by onboarding)
            if let Ok(config_dir) = app.path().app_config_dir() {
                let env_path = config_dir.join(".env");
                if env_path.exists() {
                    if let Ok(content) = std::fs::read_to_string(&env_path) {
                        for line in content.lines() {
                            let line = line.trim();
                            if line.is_empty() || line.starts_with('#') { continue; }
                            if let Some((key, value)) = line.split_once('=') {
                                std::env::set_var(key.trim(), value.trim());
                            }
                        }
                        log::info!("Loaded env from {:?}", env_path);
                    }
                }
            }

            // Initialize SQLite database
            let app_data = app.path().app_data_dir().expect("Failed to get app data dir");
            std::fs::create_dir_all(&app_data).expect("Failed to create app data dir");

            let db_path = app_data.join("holoself.db");
            let db = db::Database::new(&db_path).expect("Failed to initialize database");
            db.run_migrations().expect("Failed to run migrations");

            // Store database handle in app state
            app.manage(db::DbState(std::sync::Mutex::new(db)));

            // Configure transparent window for holographic HUD
            if let Some(_window) = app.get_webview_window("main") {
                log::info!("HoloSelf OS HUD window initialized — transparent frameless mode");
            }

            log::info!("HoloSelf OS started — Database at {:?}", db_path);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Health commands
            commands::health::log_supplement,
            commands::health::get_supplement_log,
            commands::health::get_health_timeline,
            commands::health::log_vital,
            // Agent commands
            commands::agent::get_agent_message,
            commands::agent::execute_agent_action,
            commands::agent::get_daily_stats,
            // Gemini Bridge
            commands::gemini::ocr_clinical_pdf,
            // Voice (Cartesia TTS + Whisper STT)
            commands::voice::speak,
            commands::voice::speak_agent_message,
            commands::voice::process_voice_input,
            commands::voice::process_voice_command,
            commands::voice::save_temp_audio,
            commands::voice::get_whisper_status,
            // Health Scheduler
            commands::scheduler::get_exam_schedule,
            commands::scheduler::save_scheduled_exam,
            commands::scheduler::get_upcoming_exams,
            // Vitamin D Calculator
            commands::vitamin_d::get_vitamin_d_recommendation,
            commands::vitamin_d::get_current_uv_index,
            // Settings
            commands::settings::get_settings,
            commands::settings::save_settings,
            // System
            commands::system::get_system_status,
            // Setup / Onboarding
            commands::setup::check_setup_status,
            commands::setup::check_dependencies,
            commands::setup::repair_dependencies,
            commands::setup::save_api_keys,
            commands::setup::install_whisper_auto,
        ])
        .run(tauri::generate_context!())
        .expect("Error running HoloSelf OS");
}
