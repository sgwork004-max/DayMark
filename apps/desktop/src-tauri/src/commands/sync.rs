use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

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
) -> Result<(), String> {
    std::fs::create_dir_all(&vault_path).map_err(|e| e.to_string())?;
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
        .watch(Path::new(&vault_path), RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;

    *state.0.lock().unwrap() = Some(watcher);
    Ok(())
}

#[tauri::command]
pub fn stop_file_watcher(state: State<'_, FileWatcherState>) {
    *state.0.lock().unwrap() = None;
}

#[tauri::command]
pub fn save_settings(settings_json: String) -> Result<(), String> {
    let home = std::env::var("HOME").unwrap_or_default();
    let dir = PathBuf::from(&home).join(".daymark");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let mut settings: serde_json::Value =
        serde_json::from_str(&settings_json).map_err(|e| e.to_string())?;
    if let Some(object) = settings.as_object_mut() {
        object.remove("geminiApiKey");
        object.remove("todoistApiToken");
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
    let home = std::env::var("HOME").unwrap_or_default();
    let current = PathBuf::from(&home).join(".daymark").join("settings.json");
    let legacy = PathBuf::from(&home).join(".noteplan").join("settings.json");
    let path = if current.exists() { current } else { legacy };
    if path.exists() {
        std::fs::read_to_string(path).map_err(|e| e.to_string())
    } else {
        Ok("{}".to_string())
    }
}

#[tauri::command]
pub fn read_note_from_disk(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}
