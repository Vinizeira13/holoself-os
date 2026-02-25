use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ClinicalResult {
    pub marker: String,
    pub value: f64,
    pub unit: String,
    pub reference_range: String,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OcrResult {
    pub patient_name: Option<String>,
    pub date: Option<String>,
    pub lab: Option<String>,
    pub markers: Vec<ClinicalResult>,
    pub raw_text: Option<String>,
}

/// OCR Clinical PDF via Gemini API
/// Extracts structured health markers from clinical analysis PDFs
#[tauri::command]
pub async fn ocr_clinical_pdf(
    file_path: String,
) -> Result<OcrResult, String> {
    // Security: validate file path
    let path = std::path::Path::new(&file_path);
    if !path.exists() {
        return Err(format!("File not found: {}", file_path));
    }
    let canonical = path.canonicalize()
        .map_err(|e| format!("Invalid file path: {}", e))?;

    // Block path traversal — only allow files with .pdf extension
    if canonical.extension().and_then(|e| e.to_str()) != Some("pdf") {
        return Err("Only PDF files are accepted.".to_string());
    }

    let pdf_bytes = std::fs::read(&canonical)
        .map_err(|e| format!("Failed to read PDF: {}", e))?;

    // Limit file size to 50MB
    if pdf_bytes.len() > 50_000_000 {
        return Err("PDF too large (max 50MB).".to_string());
    }

    let base64_pdf = BASE64.encode(&pdf_bytes);

    let api_key = std::env::var("GEMINI_API_KEY")
        .map_err(|_| "GEMINI_API_KEY not set. Configure in settings.".to_string())?;

    let client = reqwest::Client::new();

    let prompt = r#"You are a clinical lab results parser. Extract ALL health markers from this clinical analysis PDF.

Return a JSON object with this exact structure:
{
  "patient_name": "string or null",
  "date": "YYYY-MM-DD or null",
  "lab": "laboratory name or null",
  "markers": [
    {
      "marker": "Vitamin D",
      "value": 25.3,
      "unit": "ng/mL",
      "reference_range": "30-100",
      "status": "low"
    }
  ]
}

Focus especially on: Vitamin D, Zinc, Copper, Cortisol, TSH, T3, T4, ANA, Ferritin, B12, Iron, Hemoglobin.
Only return valid JSON, no markdown."#;

    let body = serde_json::json!({
        "contents": [{
            "parts": [
                { "text": prompt },
                {
                    "inline_data": {
                        "mime_type": "application/pdf",
                        "data": base64_pdf
                    }
                }
            ]
        }],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 4096
        }
    });

    let response = client
        .post(format!(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={}",
            api_key
        ))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Gemini API request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_body = response.text().await.unwrap_or_default();
        return Err(format!("Gemini API error {}: {}", status, error_body));
    }

    let gemini_response: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Gemini response: {}", e))?;

    let text = gemini_response["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .ok_or("No text in Gemini response")?;

    // Clean potential markdown code fences from Gemini response
    let cleaned = text
        .trim()
        .strip_prefix("```json")
        .or_else(|| text.trim().strip_prefix("```"))
        .unwrap_or(text.trim());
    let cleaned = cleaned
        .strip_suffix("```")
        .unwrap_or(cleaned)
        .trim();

    let result: OcrResult = serde_json::from_str(cleaned)
        .map_err(|e| format!("Failed to parse clinical data: {}. Raw: {}", e, text))?;

    Ok(result)
}
