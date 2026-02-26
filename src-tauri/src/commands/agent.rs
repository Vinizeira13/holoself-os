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

/// Supplement protocol definition
struct Protocol {
    name: &'static str,
    dosage: &'static str,
    category: &'static str,
    hours: std::ops::RangeInclusive<u32>,
    benefit: &'static str,
}

const PROTOCOLS: &[Protocol] = &[
    Protocol {
        name: "Winfit",
        dosage: "1 saqueta",
        category: "morning",
        hours: 8..=11,
        benefit: "Vitamina C + Zinco — sistema imunitário e recuperação capilar",
    },
    Protocol {
        name: "Vitamina D3",
        dosage: "2000 IU",
        category: "morning",
        hours: 8..=12,
        benefit: "Absorção de cálcio e regulação imunitária",
    },
    Protocol {
        name: "Ómega 3",
        dosage: "1 cápsula",
        category: "afternoon",
        hours: 12..=15,
        benefit: "Anti-inflamatório e função cognitiva",
    },
    Protocol {
        name: "Magnésio Bisglicinato",
        dosage: "1 cápsula",
        category: "night",
        hours: 22..=23,
        benefit: "Proteção folicular e sistema nervoso",
    },
    Protocol {
        name: "Noxarem (Melatonina 3mg)",
        dosage: "1 comprimido",
        category: "night",
        hours: 23..=23,
        benefit: "Sincronização do ciclo circadiano",
    },
];

/// Get the next contextual message from the HoloSelf agent
/// Calm Technology: never alarming, always solution-oriented
#[tauri::command]
pub async fn get_agent_message(
    state: State<'_, DbState>,
) -> Result<AgentMessage, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    let now = chrono::Local::now();
    let hour = now.hour();
    let today = now.format("%Y-%m-%d").to_string();

    // Pre-fetch upcoming exams (used in multiple branches)
    let upcoming_exams = db.get_upcoming_exams().unwrap_or_default();

    // 0. Check for recent voice input (last 30 seconds)
    let voice_input: Option<String> = db.query_row(
        "SELECT value FROM agent_memory WHERE key = 'voice_input' AND timestamp > datetime('now', '-30 seconds') ORDER BY rowid DESC LIMIT 1",
        &[],
        |row| row.get(0),
    ).ok();

    if let Some(ref input) = voice_input {
        let lower = input.to_lowercase();
        // Voice command processing
        if lower.contains("status") || lower.contains("como estou") || lower.contains("relatório") {
            return Ok(AgentMessage {
                text: format!(
                    "Relatório rápido: {} de {} suplementos hoje ({}%). {}",
                    PROTOCOLS.iter().filter(|p| db.check_supplement_taken(p.name, &today).unwrap_or(false)).count(),
                    PROTOCOLS.len(),
                    (PROTOCOLS.iter().filter(|p| db.check_supplement_taken(p.name, &today).unwrap_or(false)).count() as f64 / PROTOCOLS.len() as f64 * 100.0) as u32,
                    if !upcoming_exams.is_empty() {
                        format!("Próximo exame: {} em {}.", upcoming_exams[0].1, upcoming_exams[0].3)
                    } else {
                        "Sem exames próximos.".to_string()
                    }
                ),
                category: "voice_response".into(),
                priority: "high".into(),
                action: None,
            });
        } else if lower.contains("tomei") || lower.contains("registar") || lower.contains("suplemento") {
            // Try to match a protocol
            for protocol in PROTOCOLS {
                if lower.contains(&protocol.name.to_lowercase()) {
                    return Ok(AgentMessage {
                        text: format!("Registando {} — {}.", protocol.name, protocol.dosage),
                        category: "voice_response".into(),
                        priority: "high".into(),
                        action: Some(AgentAction {
                            action_type: "log_supplement".into(),
                            payload: serde_json::json!({
                                "name": protocol.name,
                                "dosage": protocol.dosage,
                                "category": protocol.category
                            }),
                        }),
                    });
                }
            }
        }

        // Generic voice acknowledgment
        return Ok(AgentMessage {
            text: format!("Entendido: \"{}\". A processar.", input),
            category: "voice_response".into(),
            priority: "medium".into(),
            action: None,
        });
    }

    // 1. Check for pending supplements in current time window
    for protocol in PROTOCOLS {
        if protocol.hours.contains(&hour) {
            let took = db.check_supplement_taken(protocol.name, &today).unwrap_or(false);
            if !took {
                return Ok(AgentMessage {
                    text: format!(
                        "{} — {}. {}",
                        protocol.name, protocol.dosage, protocol.benefit
                    ),
                    category: "supplement_reminder".into(),
                    priority: "medium".into(),
                    action: Some(AgentAction {
                        action_type: "log_supplement".into(),
                        payload: serde_json::json!({
                            "name": protocol.name,
                            "dosage": protocol.dosage,
                            "category": protocol.category
                        }),
                    }),
                });
            }
        }
    }

    // 2. Count today's adherence
    let taken_today = PROTOCOLS.iter()
        .filter(|p| db.check_supplement_taken(p.name, &today).unwrap_or(false))
        .count();
    let total = PROTOCOLS.len();
    let adherence_pct = (taken_today as f64 / total as f64 * 100.0) as u32;

    // 3. Build context for Gemini (or fallback to hardcoded)
    let supplement_names: Vec<&str> = PROTOCOLS.iter().map(|p| p.name).collect();
    let taken_names: Vec<&str> = PROTOCOLS.iter()
        .filter(|p| db.check_supplement_taken(p.name, &today).unwrap_or(false))
        .map(|p| p.name)
        .collect();
    let pending_names: Vec<&str> = PROTOCOLS.iter()
        .filter(|p| !db.check_supplement_taken(p.name, &today).unwrap_or(false))
        .map(|p| p.name)
        .collect();

    let exam_context = if !upcoming_exams.is_empty() {
        format!("Próximo exame: {} em {}.", upcoming_exams[0].1, upcoming_exams[0].3)
    } else {
        "Sem exames próximos.".to_string()
    };

    // Drop the db lock before the async Gemini call
    drop(db);

    // Try Gemini for intelligent response, fallback to templates
    let gemini_key = std::env::var("GEMINI_API_KEY").unwrap_or_default();
    if !gemini_key.is_empty() && gemini_key != "your_gemini_api_key_here" {
        match call_gemini_agent(
            &gemini_key, hour, adherence_pct,
            &taken_names, &pending_names, &supplement_names,
            &exam_context,
        ).await {
            Ok(text) => {
                return Ok(AgentMessage {
                    text,
                    category: if adherence_pct == 100 { "health_insight" } else { "calm_nudge" }.into(),
                    priority: "low".into(),
                    action: None,
                });
            }
            Err(e) => {
                log::warn!("Gemini agent call failed, using fallback: {}", e);
                // Fall through to hardcoded
            }
        }
    }

    // Fallback: hardcoded contextual messages
    let message = if taken_today == total {
        AgentMessage {
            text: format!(
                "Protocolo 100% hoje. {} de {} suplementos registados. Sistema em carga total.",
                taken_today, total
            ),
            category: "health_insight".into(),
            priority: "low".into(),
            action: None,
        }
    } else if hour >= 6 && hour < 9 {
        AgentMessage {
            text: format!(
                "Bom dia. Aderência: {}%. Pendentes: {}.",
                adherence_pct, pending_names.join(", ")
            ),
            category: "calm_nudge".into(),
            priority: "low".into(),
            action: None,
        }
    } else if hour >= 20 && hour < 23 {
        AgentMessage {
            text: format!(
                "Fase noturna. Aderência: {}%. {}",
                adherence_pct, exam_context
            ),
            category: "calm_nudge".into(),
            priority: "low".into(),
            action: None,
        }
    } else {
        AgentMessage {
            text: format!(
                "Sistema estável. Aderência: {}%. {}",
                adherence_pct,
                if !pending_names.is_empty() {
                    format!("Pendentes: {}.", pending_names.join(", "))
                } else {
                    "Tudo em dia.".to_string()
                }
            ),
            category: "health_insight".into(),
            priority: "low".into(),
            action: None,
        }
    };

    Ok(message)
}

/// Call Gemini for contextual agent intelligence
async fn call_gemini_agent(
    api_key: &str,
    hour: u32,
    adherence_pct: u32,
    taken: &[&str],
    pending: &[&str],
    all_supplements: &[&str],
    exam_context: &str,
) -> Result<String, String> {
    let time_period = match hour {
        6..=9 => "manhã (despertar)",
        10..=13 => "meio do dia (foco)",
        14..=17 => "tarde (manutenção)",
        18..=21 => "noite (desaceleração)",
        22..=23 => "noite tardia (preparar sono)",
        _ => "madrugada",
    };

    let prompt = format!(
        "Tu és o HoloSelf, um agente de saúde pessoal calmo e direto (estilo Jarvis). \
         Responde em Português (PT-BR). Máximo 2 frases curtas. Sem emojis. Tom: calmo, preciso, encorajador.\n\n\
         Contexto actual:\n\
         - Hora: {}h ({})\n\
         - Aderência hoje: {}%\n\
         - Suplementos tomados: {}\n\
         - Pendentes: {}\n\
         - Protocolo completo: {}\n\
         - {}\n\n\
         Dá uma mensagem contextual breve baseada neste estado. \
         Se tudo está em dia, encoraja. Se há pendentes, lembra com calma. \
         Se é noite, sugere desacelerar. Nunca alarmar.",
        hour, time_period, adherence_pct,
        if taken.is_empty() { "nenhum" } else { &taken.join(", ") },
        if pending.is_empty() { "nenhum" } else { &pending.join(", ") },
        all_supplements.join(", "),
        exam_context,
    );

    let client = reqwest::Client::new();
    let response = client
        .post("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent")
        .header("x-goog-api-key", api_key)
        .json(&serde_json::json!({
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "maxOutputTokens": 100,
                "temperature": 0.7,
            }
        }))
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| format!("Gemini request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Gemini API error: {}", response.status()));
    }

    let body: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;

    body.get("candidates")
        .and_then(|c| c.get(0))
        .and_then(|c| c.get("content"))
        .and_then(|c| c.get("parts"))
        .and_then(|p| p.get(0))
        .and_then(|p| p.get("text"))
        .and_then(|t| t.as_str())
        .map(|s| s.trim().to_string())
        .ok_or("Gemini returned empty response".to_string())
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
        "log_vital" => {
            let vital_type = payload["type"].as_str().unwrap_or("unknown");
            let value = payload["value"].as_f64().unwrap_or(0.0);
            let unit = payload["unit"].as_str().unwrap_or("");
            let now = chrono::Local::now().to_rfc3339();

            let entry = crate::commands::health::VitalEntry {
                id: None,
                vital_type: vital_type.to_string(),
                value,
                unit: unit.to_string(),
                recorded_at: now,
                source: "agent".to_string(),
            };
            db.insert_vital(&entry).map_err(|e| e.to_string())?;
            Ok(format!("{} registado: {}", vital_type, value))
        }
        _ => Err(format!("Ação desconhecida: {}", action_type)),
    }
}

// Voice input moved to commands::voice (Whisper.cpp integration)

/// Daily stats for summary (Feature 5)
#[derive(serde::Serialize)]
pub struct DailyStats {
    pub adherence_percent: u32,
    pub breaks_taken: u32,
    pub avg_posture_score: u32,
    pub focus_minutes: u32,
    pub voice_commands: u32,
}

#[tauri::command]
pub async fn get_daily_stats(
    state: State<'_, DbState>,
) -> Result<DailyStats, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;

    // Count today's supplement adherence
    let total_supplements: u32 = db.query_row(
        "SELECT COUNT(*) FROM supplements",
        &[],
        |row| row.get(0),
    ).unwrap_or(0);

    let taken_today: u32 = db.query_row(
        "SELECT COUNT(*) FROM supplements WHERE DATE(taken_at) = DATE('now')",
        &[],
        |row| row.get(0),
    ).unwrap_or(0);

    let adherence = if total_supplements > 0 {
        ((taken_today as f64 / total_supplements as f64) * 100.0) as u32
    } else {
        0
    };

    // Voice commands today
    let voice_count: u32 = db.query_row(
        "SELECT COUNT(*) FROM agent_memory WHERE key = 'voice_input' AND date(timestamp) = date('now')",
        &[],
        |row| row.get(0),
    ).unwrap_or(0);

    Ok(DailyStats {
        adherence_percent: adherence,
        breaks_taken: 0,
        avg_posture_score: 0,
        focus_minutes: 0,
        voice_commands: voice_count,
    })
}
