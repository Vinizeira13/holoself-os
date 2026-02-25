use serde::{Deserialize, Serialize};

/// Cartesia.ai Sonic API — Real-time Text-to-Speech
/// Sub-100ms latency voice synthesis for the HoloSelf agent

const CARTESIA_API_URL: &str = "https://api.cartesia.ai/tts/bytes";

#[derive(Debug, Serialize)]
struct CartesiaRequest {
    model_id: String,
    transcript: String,
    voice: CartesiaVoice,
    output_format: CartesiaFormat,
}

#[derive(Debug, Serialize)]
struct CartesiaVoice {
    mode: String,
    id: String,
}

#[derive(Debug, Serialize)]
struct CartesiaFormat {
    container: String,
    sample_rate: u32,
    encoding: String,
}

#[derive(Debug, Deserialize)]
pub struct CartesiaConfig {
    pub api_key: String,
    pub voice_id: String,
    pub model_id: String,
}

impl Default for CartesiaConfig {
    fn default() -> Self {
        Self {
            api_key: String::new(),
            // Default: calm, warm male voice (can be changed in settings)
            voice_id: "a0e99841-438c-4a64-b679-ae501e7d6091".to_string(),
            model_id: "sonic-2".to_string(),
        }
    }
}

/// Synthesize speech from text using Cartesia Sonic API
/// Returns raw WAV audio bytes
pub async fn synthesize(text: &str, config: &CartesiaConfig) -> Result<Vec<u8>, String> {
    if config.api_key.is_empty() {
        return Err("CARTESIA_API_KEY not configured.".to_string());
    }

    let request = CartesiaRequest {
        model_id: config.model_id.clone(),
        transcript: text.to_string(),
        voice: CartesiaVoice {
            mode: "id".to_string(),
            id: config.voice_id.clone(),
        },
        output_format: CartesiaFormat {
            container: "wav".to_string(),
            sample_rate: 24000,
            encoding: "pcm_s16le".to_string(),
        },
    };

    let client = reqwest::Client::new();
    let response = client
        .post(CARTESIA_API_URL)
        .header("X-API-Key", &config.api_key)
        .header("Cartesia-Version", "2024-06-10")
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Cartesia API error: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Cartesia API {} — {}", status, body));
    }

    let audio_bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read audio: {}", e))?;

    Ok(audio_bytes.to_vec())
}
