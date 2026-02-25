use tauri::State;
use crate::db::DbState;
use crate::services::scheduler::{self, ScheduledExam, SupplementInfo, LabInfo};

/// Get predicted exam schedule based on current supplement protocol and lab history
#[tauri::command]
pub async fn get_exam_schedule(
    state: State<'_, DbState>,
) -> Result<Vec<ScheduledExam>, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;

    // Get distinct supplements taken in last 90 days
    let supplements = db.get_active_supplements()
        .map_err(|e| e.to_string())?;

    // Get latest lab results
    let labs = db.get_latest_labs()
        .map_err(|e| e.to_string())?;

    let supp_info: Vec<SupplementInfo> = supplements.iter().map(|s| SupplementInfo {
        name: s.clone(),
        started_date: String::new(),
    }).collect();

    let lab_info: Vec<LabInfo> = labs.iter().map(|l| LabInfo {
        marker: l.0.clone(),
        date: l.1.clone(),
    }).collect();

    Ok(scheduler::generate_exam_schedule(&supp_info, &lab_info))
}

/// Save a scheduled exam to the database
#[tauri::command]
pub async fn save_scheduled_exam(
    state: State<'_, DbState>,
    exam: ScheduledExam,
) -> Result<i64, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    db.insert_scheduled_exam(&exam).map_err(|e| e.to_string())
}

/// Get upcoming scheduled exams
#[tauri::command]
pub async fn get_upcoming_exams(
    state: State<'_, DbState>,
) -> Result<Vec<(i64, String, String, String, bool)>, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    db.get_upcoming_exams().map_err(|e| e.to_string())
}
