use serde::{Deserialize, Serialize};
use std::process::Command;

use super::secrets::{delete_secret_value, get_secret_value, set_secret_value};

const ACCESS_TOKEN_KEY: &str = "manager_ai_access_token";

#[derive(Debug, Deserialize)]
struct GeminiTextBlock {
    text: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GeminiStep {
    #[serde(default)]
    output: Vec<GeminiTextBlock>,
    #[serde(default)]
    content: Vec<GeminiTextBlock>,
}

#[derive(Debug, Deserialize)]
struct GeminiResponse {
    output_text: Option<String>,
    #[serde(default)]
    steps: Vec<GeminiStep>,
}

#[derive(Debug, Deserialize)]
struct ErrorBody {
    error: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GatewayActivationResponse {
    access_token: String,
    status: String,
    credit_limit: i64,
    used_credits: i64,
    remaining_credits: i64,
    expires_at: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GatewayGenerateResponse {
    text: String,
    credit_limit: i64,
    used_credits: i64,
    remaining_credits: i64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiAccessStatus {
    pub status: String,
    pub credit_limit: i64,
    pub used_credits: i64,
    pub remaining_credits: i64,
    pub expires_at: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiGenerateResult {
    pub text: String,
    pub source: String,
    pub credit_limit: Option<i64>,
    pub used_credits: Option<i64>,
    pub remaining_credits: Option<i64>,
}

fn validate_gateway_url(value: &str) -> Result<String, String> {
    let value = value.trim().trim_end_matches('/');
    if value.starts_with("https://")
        || value.starts_with("http://127.0.0.1")
        || value.starts_with("http://localhost")
    {
        Ok(value.to_string())
    } else {
        Err("Manager AI service URL must use HTTPS.".to_string())
    }
}

fn run_curl(
    url: &str,
    method: &str,
    headers: &[String],
    body: Option<&str>,
) -> Result<String, String> {
    let mut command = Command::new("/usr/bin/curl");
    command.args([
        "--silent",
        "--show-error",
        "--fail-with-body",
        "--connect-timeout",
        "8",
        "--max-time",
        "45",
        "-X",
        method,
        url,
    ]);
    for header in headers {
        command.args(["-H", header]);
    }
    if let Some(body) = body {
        command.args(["-d", body]);
    }
    let output = command
        .output()
        .map_err(|e| format!("Could not reach Manager AI: {e}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    if output.status.success() {
        return Ok(stdout);
    }
    if let Ok(parsed) = serde_json::from_str::<ErrorBody>(&stdout) {
        if let Some(error) = parsed.error {
            if let Some(message) = error.as_str() {
                return Err(message.to_string());
            }
            if let Some(message) = error.get("message").and_then(|value| value.as_str()) {
                return Err(message.to_string());
            }
        }
    }
    if !stdout.trim().is_empty() {
        return Err(stdout.trim().to_string());
    }
    if !stderr.trim().is_empty() {
        return Err(stderr.trim().to_string());
    }
    Err("Manager AI request failed.".to_string())
}

fn extract_text(body: &str) -> Result<String, String> {
    let parsed: GeminiResponse = serde_json::from_str(body)
        .map_err(|_| "Gemini returned an unexpected response.".to_string())?;
    if let Some(text) = parsed.output_text {
        if !text.trim().is_empty() {
            return Ok(text);
        }
    }
    let mut parts = Vec::new();
    for step in parsed.steps {
        for block in step.output.into_iter().chain(step.content.into_iter()) {
            if let Some(text) = block.text {
                parts.push(text);
            }
        }
    }
    let text = parts.join("");
    if text.trim().is_empty() {
        Err("Gemini returned an empty response.".to_string())
    } else {
        Ok(text)
    }
}

fn access_status_from_gateway(gateway_url: &str, token: &str) -> Result<AiAccessStatus, String> {
    let auth = format!("Authorization: Bearer {token}");
    let raw = run_curl(&format!("{gateway_url}/v1/access"), "GET", &[auth], None)?;
    serde_json::from_str(&raw)
        .map_err(|_| "Manager AI returned an invalid access response.".to_string())
}

#[tauri::command]
pub async fn activate_manager_ai(
    gateway_url: String,
    activation_code: String,
    device_id: String,
) -> Result<AiAccessStatus, String> {
    let gateway_url = validate_gateway_url(&gateway_url)?;
    if activation_code.trim().is_empty() || device_id.trim().is_empty() {
        return Err("Enter a valid Manager activation code.".to_string());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let body = serde_json::json!({
            "activationCode": activation_code.trim(),
            "deviceId": device_id.trim(),
        })
        .to_string();
        let raw = run_curl(
            &format!("{gateway_url}/v1/activate"),
            "POST",
            &["Content-Type: application/json".to_string()],
            Some(&body),
        )?;
        let response: GatewayActivationResponse = serde_json::from_str(&raw)
            .map_err(|_| "Manager AI returned an invalid activation response.".to_string())?;
        set_secret_value(ACCESS_TOKEN_KEY, &response.access_token)?;
        Ok(AiAccessStatus {
            status: response.status,
            credit_limit: response.credit_limit,
            used_credits: response.used_credits,
            remaining_credits: response.remaining_credits,
            expires_at: response.expires_at,
        })
    })
    .await
    .map_err(|error| format!("Activation task failed: {error}"))?
}

#[tauri::command]
pub async fn get_manager_ai_status(gateway_url: String) -> Result<AiAccessStatus, String> {
    let gateway_url = validate_gateway_url(&gateway_url)?;
    let token = get_secret_value(ACCESS_TOKEN_KEY)?;
    if token.is_empty() {
        return Err("Manager AI is not activated.".to_string());
    }
    tauri::async_runtime::spawn_blocking(move || access_status_from_gateway(&gateway_url, &token))
        .await
        .map_err(|error| format!("AI status task failed: {error}"))?
}

#[tauri::command]
pub fn disconnect_manager_ai() -> Result<(), String> {
    delete_secret_value(ACCESS_TOKEN_KEY)
}

#[tauri::command]
pub async fn gemini_generate(
    gateway_url: Option<String>,
    system_instruction: String,
    input: String,
) -> Result<AiGenerateResult, String> {
    let gateway_url = gateway_url.unwrap_or_default();
    let access_token = get_secret_value(ACCESS_TOKEN_KEY).unwrap_or_default();
    let personal_key = get_secret_value("gemini_api_key").unwrap_or_default();

    tauri::async_runtime::spawn_blocking(move || {
        if !gateway_url.trim().is_empty() && !access_token.is_empty() {
            let gateway_url = validate_gateway_url(&gateway_url)?;
            let auth = format!("Authorization: Bearer {access_token}");
            let body = serde_json::json!({
                "systemInstruction": system_instruction,
                "input": input,
            })
            .to_string();
            let raw = run_curl(
                &format!("{gateway_url}/v1/generate"),
                "POST",
                &[auth, "Content-Type: application/json".to_string()],
                Some(&body),
            )?;
            let response: GatewayGenerateResponse = serde_json::from_str(&raw)
                .map_err(|_| "Manager AI returned an invalid response.".to_string())?;
            return Ok(AiGenerateResult {
                text: response.text,
                source: "manager".to_string(),
                credit_limit: Some(response.credit_limit),
                used_credits: Some(response.used_credits),
                remaining_credits: Some(response.remaining_credits),
            });
        }

        if personal_key.trim().is_empty() {
            return Err("Activate Manager AI in Settings to use the assistant.".to_string());
        }
        let key_header = format!("x-goog-api-key: {}", personal_key.trim());
        let body = serde_json::json!({
            "model": "gemini-3.5-flash",
            "system_instruction": system_instruction,
            "input": input,
            "generation_config": {
                "temperature": 0.7,
                "max_output_tokens": 2048,
                "thinking_level": "low"
            }
        })
        .to_string();
        let raw = run_curl(
            "https://generativelanguage.googleapis.com/v1beta/interactions",
            "POST",
            &[key_header, "Content-Type: application/json".to_string()],
            Some(&body),
        )?;
        Ok(AiGenerateResult {
            text: extract_text(&raw)?,
            source: "personal".to_string(),
            credit_limit: None,
            used_credits: None,
            remaining_credits: None,
        })
    })
    .await
    .map_err(|error| format!("Gemini task failed: {error}"))?
}
