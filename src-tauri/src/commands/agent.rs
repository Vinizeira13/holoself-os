use chrono::Timelike;
use serde::{Deserialize, Serialize};
use tauri::State;
use crate::db::DbState;

#[derive(Debug, Serialize, Deserialize)]
pub struct AgentMessage {
    pub text: String,
    pub category: String,
    pub priority: String,
    pub action: Option<AgentAction>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AgentAction {
    pub action_type: String,
    pub payload: serde_json::Value,
}

/// Get the next contextual message from the HoloSelf agent
/// Calm Technology: never alarming, always solution-oriented
#[tauri::command]
pub async fn get_agent_message(
    state: State<'_, DbState>,
) -> Result<AgentMessage, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;

    let now = chrono::Local::now();
    let hour = now.hour();

    let message = match hour {
        8..=11 => {
            let today = now.format("%Y-%m-%d").to_string();
            let took_winfit = db.check_supplement_taken("Winfit", &today)
                .unwrap_or(false);

            if !took_winfit {
                AgentMessage {
                    text: "Bom dia. O Winfit está à espera — 1000mg de Vitamina C + Zinco para fortalecer o sistema imunitário e apoiar a recuperação capilar.".into(),
                    category: "supplement_reminder".into(),
                    priority: "medium".into(),
                    action: Some(AgentAction {
                        action_type: "log_supplement".into(),
                        payload: serde_json::json!({
                            "name": "Winfit",
                            "dosage": "1 saqueta",
                            "category": "morning"
                        }),
                    }),
                }
            } else {
                AgentMessage {
                    text: "Winfit registado. Sistema imunitário em carga. Foco total.".into(),
                    category: "health_insight".into(),
                    priority: "low".into(),
                    action: None,
                }
            }
        }
        0..=2 => {
            AgentMessage {
                text: "Atingimos a latência ótima. Está na hora do Magnésio Bisglicinato para proteger os folículos capilares e o sistema nervoso.".into(),
                category: "supplement_reminder".into(),
                priority: "medium".into(),
                action: Some(AgentAction {
                    action_type: "log_supplement".into(),
                    payload: serde_json::json!({
                        "name": "Magnésio Bisglicinato",
                        "dosage": "1 cápsula",
                        "category": "night"
                    }),
                }),
            }
        }
        23 => {
            AgentMessage {
                text: "01:30 aproxima-se. Prepara o Noxarem — Melatonina 3mg para sincronizar o ciclo circadiano.".into(),
                category: "supplement_reminder".into(),
                priority: "medium".into(),
                action: Some(AgentAction {
                    action_type: "log_supplement".into(),
                    payload: serde_json::json!({
                        "name": "Noxarem (Melatonina 3mg)",
                        "dosage": "1 comprimido",
                        "category": "night"
                    }),
                }),
            }
        }
        _ => {
            AgentMessage {
                text: "Sistema estável. A monitorizar indicadores de recuperação.".into(),
                category: "health_insight".into(),
                priority: "low".into(),
                action: None,
            }
        }
    };

    Ok(message)
}

/// Execute an agent-suggested action (called from frontend after user confirms)
#[tauri::command]
pub async fn execute_agent_action(
    state: State<'_, DbState>,
    action_type: String,
    payload: serde_json::Value,
) -> Result<String, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;

    match action_type.as_str() {
        "log_supplement" => {
            let name = payload["name"].as_str().unwrap_or("Unknown");
            let dosage = payload["dosage"].as_str().unwrap_or("");
            let category = payload["category"].as_str().unwrap_or("as_needed");
            let now = chrono::Local::now().to_rfc3339();

            let entry = crate::commands::health::SupplementEntry {
                id: None,
                name: name.to_string(),
                dosage: dosage.to_string(),
                taken_at: now,
                category: category.to_string(),
                notes: None,
            };
            db.insert_supplement(&entry).map_err(|e| e.to_string())?;
            Ok(format!("{} registado com sucesso.", name))
        }
        _ => Err(format!("Ação desconhecida: {}", action_type)),
    }
}

/// Process voice input via Whisper.cpp (placeholder)
#[tauri::command]
pub async fn process_voice_input(
    _audio_path: String,
) -> Result<String, String> {
    Err("Voice input not yet implemented — Whisper.cpp integration pending".into())
}
