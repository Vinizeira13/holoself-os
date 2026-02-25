use serde::{Deserialize, Serialize};
use tauri::State;
use crate::db::DbState;

#[derive(Debug, Serialize, Deserialize)]
pub struct SupplementEntry {
    pub id: Option<i64>,
    pub name: String,
    pub dosage: String,
    pub taken_at: String,   // ISO 8601 datetime
    pub category: String,   // morning | night | as_needed
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VitalEntry {
    pub id: Option<i64>,
    pub vital_type: String, // heart_rate | hrv | sleep_score | stress_level | wpm
    pub value: f64,
    pub unit: String,
    pub recorded_at: String,
    pub source: String,     // manual | wearable | webcam
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HealthTimelineEntry {
    pub timestamp: String,
    pub event_type: String,
    pub label: String,
    pub value: Option<f64>,
}

/// Log a supplement intake
#[tauri::command]
pub async fn log_supplement(
    state: State<'_, DbState>,
    entry: SupplementEntry,
) -> Result<i64, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    db.insert_supplement(&entry).map_err(|e| e.to_string())
}

/// Get supplement log for a date range
#[tauri::command]
pub async fn get_supplement_log(
    state: State<'_, DbState>,
    from: String,
    to: String,
) -> Result<Vec<SupplementEntry>, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    db.get_supplements(&from, &to).map_err(|e| e.to_string())
}

/// Get unified health timeline
#[tauri::command]
pub async fn get_health_timeline(
    state: State<'_, DbState>,
    from: String,
    to: String,
) -> Result<Vec<HealthTimelineEntry>, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    db.get_health_timeline(&from, &to).map_err(|e| e.to_string())
}

/// Log a vital sign measurement
#[tauri::command]
pub async fn log_vital(
    state: State<'_, DbState>,
    entry: VitalEntry,
) -> Result<i64, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    db.insert_vital(&entry).map_err(|e| e.to_string())
}
