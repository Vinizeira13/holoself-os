use serde::{Deserialize, Serialize};

/// Vitamin D3 Calculator
/// Calculates optimal sun exposure based on UV index, skin type (Fitzpatrick), and location

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VitaminDRecommendation {
    pub uv_index: f64,
    pub skin_type: u8,          // Fitzpatrick scale 1-6
    pub latitude: f64,
    pub optimal_minutes: u32,    // Minutes of sun exposure needed
    pub best_window: String,     // e.g., "11:00 - 14:00"
    pub d3_iu_supplement: u32,   // Recommended IU if sun is insufficient
    pub note: String,
}

/// Fitzpatrick skin type classification
/// Type 3-4 = "Lightskin" Afro-Brazilian + Euro-Portuguese mix
const DEFAULT_SKIN_TYPE: u8 = 4;

/// Portugal latitude (Lisbon)
const PORTUGAL_LATITUDE: f64 = 38.7;

/// Calculate Vitamin D recommendation
pub fn calculate(
    uv_index: f64,
    skin_type: Option<u8>,
    latitude: Option<f64>,
    month: u32,
) -> VitaminDRecommendation {
    let skin = skin_type.unwrap_or(DEFAULT_SKIN_TYPE);
    let lat = latitude.unwrap_or(PORTUGAL_LATITUDE);

    // Base MED (Minimal Erythemal Dose) by Fitzpatrick type — in minutes at UV 6
    let base_med_minutes: f64 = match skin {
        1 => 10.0,   // Very fair — burns easily
        2 => 15.0,   // Fair
        3 => 20.0,   // Medium
        4 => 30.0,   // Olive / Lightskin
        5 => 45.0,   // Brown
        6 => 60.0,   // Dark
        _ => 30.0,
    };

    // Adjust for UV index (inversely proportional)
    // At UV 1, need ~6x more time than UV 6
    let uv_factor = if uv_index > 0.0 { 6.0 / uv_index } else { 10.0 };
    let adjusted_minutes = (base_med_minutes * uv_factor * 0.5).round() as u32; // 50% of MED = safe

    // Clamp to reasonable range
    let optimal_minutes = adjusted_minutes.clamp(10, 120);

    // Best sun window depends on latitude and season
    let best_window = if lat > 45.0 {
        // Northern latitudes — narrower window
        "11:30 - 13:30".to_string()
    } else if lat > 35.0 {
        // Portugal latitude
        match month {
            11 | 12 | 1 | 2 => "11:00 - 14:00".to_string(),  // Winter — wider window needed
            3 | 4 | 9 | 10 => "11:00 - 15:00".to_string(),    // Spring/Autumn
            _ => "10:00 - 16:00".to_string(),                   // Summer
        }
    } else {
        "10:00 - 16:00".to_string()
    };

    // Supplement recommendation when UV is too low
    let d3_iu_supplement = if uv_index < 3.0 {
        // Low UV — need significant supplementation
        match skin {
            1..=2 => 2000,
            3..=4 => 3000, // Darker skin needs more
            _ => 4000,
        }
    } else if uv_index < 5.0 {
        match skin {
            1..=2 => 1000,
            3..=4 => 2000,
            _ => 3000,
        }
    } else {
        // UV ≥ 5 — sun is sufficient with exposure
        match skin {
            1..=3 => 0,
            _ => 1000, // Darker skin may still benefit
        }
    };

    let note = if uv_index < 2.0 {
        format!(
            "UV muito baixo ({:.0}). Em Portugal no inverno, é quase impossível sintetizar Vitamina D suficiente. Suplementação de {}IU/dia é essencial para fototipo {}.",
            uv_index, d3_iu_supplement, skin
        )
    } else if uv_index < 4.0 {
        format!(
            "UV moderado ({:.0}). {} minutos de exposição solar diária no período {} com braços e rosto expostos. Suplementar {}IU/dia como apoio.",
            uv_index, optimal_minutes, best_window, d3_iu_supplement
        )
    } else {
        format!(
            "UV bom ({:.0}). {} minutos de exposição solar no período {} são suficientes. Sem necessidade de suplementação extra.",
            uv_index, optimal_minutes, best_window
        )
    };

    VitaminDRecommendation {
        uv_index,
        skin_type: skin,
        latitude: lat,
        optimal_minutes,
        best_window,
        d3_iu_supplement,
        note,
    }
}
