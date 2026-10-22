use serde::{Deserialize, Serialize};
use std::process::Command;

use super::secrets::get_secret_value;

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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiGenerateResult {
    pub text: String,
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
        .map_err(|e| format!("Could not reach Gemini: {e}"))?;
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
    Err("Gemini request failed.".to_string())
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

#[tauri::command]
pub async fn gemini_generate(
    system_instruction: String,
    input: String,
) -> Result<AiGenerateResult, String> {
    let personal_key = get_secret_value("gemini_api_key").unwrap_or_default();

    tauri::async_runtime::spawn_blocking(move || {
        if personal_key.trim().is_empty() {
            return Err("Add a Gemini API key in Settings to use the assistant.".to_string());
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
        })
    })
    .await
    .map_err(|error| format!("Gemini task failed: {error}"))?
}
