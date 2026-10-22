use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

use super::vault::VaultState;

pub struct FileWatcherState(pub Mutex<Option<RecommendedWatcher>>);

impl FileWatcherState {
    pub fn new() -> Self {
        Self(Mutex::new(None))
    }
}

#[tauri::command]
pub fn icloud_vault_path() -> String {
    let home = std::env::var("HOME").unwrap_or_default();
    let base = PathBuf::from(&home).join("Library/Mobile Documents/com~apple~CloudDocs");
    for name in ["Manager", "Daymark", "NotePlan"] {
        let candidate = base.join(name);
        if candidate.exists() {
            return candidate.to_string_lossy().into_owned();
        }
    }
    base.join("Manager").to_string_lossy().into_owned()
}

#[tauri::command]
pub fn start_file_watcher(
    app: AppHandle,
    vault_path: String,
    state: State<'_, FileWatcherState>,
    vault: State<'_, VaultState>,
) -> Result<(), String> {
    let vault_path = vault.resolve(&vault_path)?;
    // Drop previous watcher first
    *state.0.lock().unwrap() = None;

    let app_clone = app.clone();

    let mut watcher = notify::recommended_watcher(move |res: notify::Result<Event>| {
        let Ok(event) = res else { return };

        let kind_str = match &event.kind {
            EventKind::Create(_) => "created",
            EventKind::Modify(_) => "modified",
            EventKind::Remove(_) => "removed",
            _ => return,
        };

        for path in &event.paths {
            if path.extension().map_or(false, |e| e == "md") {
                let path_str = path.to_string_lossy().to_string();
                let _ = app_clone.emit(
                    "vault:file-changed",
                    serde_json::json!({ "path": path_str, "kind": kind_str }),
                );
            }
        }
    })
    .map_err(|e| e.to_string())?;

    watcher
        .watch(&vault_path, RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;

    *state.0.lock().unwrap() = Some(watcher);
    Ok(())
}

#[tauri::command]
pub fn stop_file_watcher(state: State<'_, FileWatcherState>) {
    *state.0.lock().unwrap() = None;
}

fn settings_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_default();
    let current = PathBuf::from(&home).join(".daymark").join("settings.json");
    let legacy = PathBuf::from(&home).join(".noteplan").join("settings.json");
    if current.exists() { current } else { legacy }
}

/// The vault recorded in saved settings, if any.
pub fn saved_vault_path() -> Option<String> {
    let text = std::fs::read_to_string(settings_path()).ok()?;
    let settings: serde_json::Value = serde_json::from_str(&text).ok()?;
    settings
        .get("vaultPath")?
        .as_str()
        .filter(|path| !path.trim().is_empty())
        .map(str::to_string)
}

#[tauri::command]
pub fn save_settings(settings_json: String, vault: State<'_, VaultState>) -> Result<(), String> {
    let home = std::env::var("HOME").unwrap_or_default();
    let dir = PathBuf::from(&home).join(".daymark");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let mut settings: serde_json::Value =
        serde_json::from_str(&settings_json).map_err(|e| e.to_string())?;
    if let Some(path) = settings.get("vaultPath").and_then(|path| path.as_str()) {
        if !path.trim().is_empty() {
            vault.activate(path)?;
        }
    }
    if let Some(object) = settings.as_object_mut() {
        object.remove("geminiApiKey");
        object.remove("todoistApiToken");
        object.remove("aiGatewayUrl");
        object.remove("aiDeviceId");
        object.remove("claudeApiKey");
    }
    let sanitized = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    let path = dir.join("settings.json");
    let temp = dir.join(format!(".settings-{}.tmp", std::process::id()));
    std::fs::write(&temp, sanitized).map_err(|e| e.to_string())?;
    std::fs::rename(temp, path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_settings() -> Result<String, String> {
    let path = settings_path();
    if path.exists() {
        std::fs::read_to_string(path).map_err(|e| e.to_string())
    } else {
        Ok("{}".to_string())
    }
}

#[tauri::command]
pub fn read_note_from_disk(path: String, vault: State<'_, VaultState>) -> Result<String, String> {
    std::fs::read_to_string(vault.resolve_readable(&path)?).map_err(|e| e.to_string())
}
