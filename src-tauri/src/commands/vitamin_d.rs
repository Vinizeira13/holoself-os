use crate::services::vitamin_d::{self, VitaminDRecommendation};

/// Get Vitamin D recommendation based on current UV index
#[tauri::command]
pub async fn get_vitamin_d_recommendation(
    uv_index: f64,
    month: Option<u32>,
) -> Result<VitaminDRecommendation, String> {
    let current_month = month.unwrap_or_else(|| {
        chrono::Local::now().format("%m").to_string().parse().unwrap_or(1)
    });

    // Skin type 4 (Lightskin Afro-Brazilian + Euro-Portuguese)
    // Latitude: Portugal (38.7°N)
    Ok(vitamin_d::calculate(uv_index, Some(4), Some(38.7), current_month))
}

/// Fetch current UV index from Open-Meteo API (free, no key needed)
#[tauri::command]
pub async fn get_current_uv_index(
    latitude: Option<f64>,
    longitude: Option<f64>,
) -> Result<f64, String> {
    let lat = latitude.unwrap_or(38.7223);   // Lisbon default
    let lon = longitude.unwrap_or(-9.1393);

    let url = format!(
        "https://api.open-meteo.com/v1/forecast?latitude={}&longitude={}&current=uv_index",
        lat, lon
    );

    let client = reqwest::Client::new();
    let response = client.get(&url)
        .send()
        .await
        .map_err(|e| format!("Weather API error: {}", e))?;

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse weather data: {}", e))?;

    data["current"]["uv_index"]
        .as_f64()
        .ok_or_else(|| "UV index not available.".to_string())
}
