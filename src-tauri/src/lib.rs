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
        .setup(|app| {
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
            commands::agent::process_voice_input,
            // Gemini Bridge
            commands::gemini::ocr_clinical_pdf,
            // System
            commands::system::get_system_status,
        ])
        .run(tauri::generate_context!())
        .expect("Error running HoloSelf OS");
}
