use chrono::Utc;
use serde::Serialize;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri::State;

use super::vault::VaultState;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Diagnostics {
    app_version: String,
    operating_system: String,
    architecture: String,
    vault_path: String,
    vault_exists: bool,
    vault_writable: bool,
    settings_path: String,
    crash_reports: usize,
    generated_at: String,
}

fn daymark_dir() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_default();
    PathBuf::from(home).join(".daymark")
}

fn log_dir() -> PathBuf {
    daymark_dir().join("logs")
}

fn vault_is_writable(path: &Path) -> bool {
    if std::fs::create_dir_all(path).is_err() {
        return false;
    }
    let probe = path.join(".daymark-write-probe");
    let result = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(&probe)
        .and_then(|mut file| file.write_all(b"ok"));
    let _ = std::fs::remove_file(probe);
    result.is_ok()
}

fn collect_diagnostics(vault: &VaultState) -> Diagnostics {
    let vault = vault.root().unwrap_or_default();
    let vault_path = vault.to_string_lossy().into_owned();
    let reports = std::fs::read_dir(log_dir())
        .map(|entries| entries.filter_map(Result::ok).count())
        .unwrap_or(0);

    Diagnostics {
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        operating_system: std::env::consts::OS.to_string(),
        architecture: std::env::consts::ARCH.to_string(),
        vault_path,
        vault_exists: vault.exists(),
        vault_writable: vault_is_writable(&vault),
        settings_path: daymark_dir().join("settings.json").to_string_lossy().into_owned(),
        crash_reports: reports,
        generated_at: Utc::now().to_rfc3339(),
    }
}

#[tauri::command]
pub fn report_app_error(
    message: String,
    stack: Option<String>,
    component_stack: Option<String>,
) -> Result<(), String> {
    let dir = log_dir();
    std::fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    let timestamp = Utc::now();
    let filename = format!("crash-{}.log", timestamp.format("%Y%m%d-%H%M%S"));
    let report = format!(
        "Manager crash report\nGenerated: {}\nVersion: {}\nOS: {} {}\n\nMessage:\n{}\n\nStack:\n{}\n\nComponent stack:\n{}\n",
        timestamp.to_rfc3339(),
        env!("CARGO_PKG_VERSION"),
        std::env::consts::OS,
        std::env::consts::ARCH,
        message,
        stack.unwrap_or_else(|| "Not available".to_string()),
        component_stack.unwrap_or_else(|| "Not available".to_string()),
    );
    std::fs::write(dir.join(filename), report).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_diagnostics(vault: State<'_, VaultState>) -> Diagnostics {
    collect_diagnostics(&vault)
}

#[tauri::command]
pub fn export_diagnostics(vault: State<'_, VaultState>) -> Result<String, String> {
    let diagnostics = collect_diagnostics(&vault);
    let dir = daymark_dir();
    std::fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    let path = dir.join("diagnostics.json");
    let json = serde_json::to_string_pretty(&diagnostics).map_err(|error| error.to_string())?;
    std::fs::write(&path, json).map_err(|error| error.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}
