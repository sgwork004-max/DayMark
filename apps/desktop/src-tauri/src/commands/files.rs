use serde::{Deserialize, Serialize};
use std::fs;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use walkdir::WalkDir;

static TEMP_COUNTER: AtomicU64 = AtomicU64::new(0);
const BACKUP_INTERVAL: Duration = Duration::from_secs(5 * 60);

/// Preserve existing vaults; new installations use ~/Manager.
#[tauri::command]
pub fn default_vault_path() -> String {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    let home = PathBuf::from(home);
    for name in ["Manager", "Daymark", "NotePlan"] {
        let candidate = home.join(name);
        if candidate.exists() {
            return candidate.to_string_lossy().into_owned();
        }
    }
    home.join("Manager").to_string_lossy().into_owned()
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NoteFile {
    pub path: String,
    pub filename: String,
    pub content: String,
    pub modified_at: u64,
    pub created_at: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NoteStub {
    pub path: String,
    pub filename: String,
    pub modified_at: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FolderEntry {
    pub name: String,
    pub path: String,
    pub note_count: usize,
}

fn file_timestamp(metadata: &fs::Metadata, modified: bool) -> u64 {
    let time = if modified {
        metadata.modified().unwrap_or(UNIX_EPOCH)
    } else {
        metadata.created().unwrap_or(UNIX_EPOCH)
    };
    time.duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn temporary_path(path: &Path, suffix: &str) -> Result<PathBuf, String> {
    let parent = path
        .parent()
        .ok_or_else(|| "Note path has no parent folder.".to_string())?;
    let filename = path.file_name().unwrap_or_default().to_string_lossy();
    let counter = TEMP_COUNTER.fetch_add(1, Ordering::Relaxed);
    Ok(parent.join(format!(
        ".{filename}.{}.{}.{suffix}",
        std::process::id(),
        counter
    )))
}

fn backup_if_due(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }
    let parent = path
        .parent()
        .ok_or_else(|| "Note path has no parent folder.".to_string())?;
    let backup_dir = parent.join(".manager-backups");
    let filename = path.file_name().unwrap_or_default().to_string_lossy();
    let backup_path = backup_dir.join(format!("{filename}.bak"));
    let backup_is_due = fs::metadata(&backup_path)
        .and_then(|metadata| metadata.modified())
        .ok()
        .and_then(|modified| SystemTime::now().duration_since(modified).ok())
        .map_or(true, |age| age >= BACKUP_INTERVAL);
    if !backup_is_due {
        return Ok(());
    }

    fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;
    let temp_backup = backup_dir.join(format!(".{filename}.{}.backup", std::process::id()));
    fs::copy(path, &temp_backup).map_err(|e| e.to_string())?;
    fs::rename(&temp_backup, &backup_path).map_err(|e| e.to_string())
}

fn atomic_write(path: &Path, content: &str, keep_backup: bool) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "Note path has no parent folder.".to_string())?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    if keep_backup {
        backup_if_due(path)?;
    }

    let temp_path = temporary_path(path, "write")?;
    let result = (|| -> Result<(), String> {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temp_path)
            .map_err(|e| e.to_string())?;
        file.write_all(content.as_bytes())
            .map_err(|e| e.to_string())?;
        file.sync_all().map_err(|e| e.to_string())?;
        fs::rename(&temp_path, path).map_err(|e| e.to_string())?;
        if let Ok(directory) = OpenOptions::new().read(true).open(parent) {
            let _ = directory.sync_all();
        }
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temp_path);
    }
    result
}

/// Read a single note file
#[tauri::command]
pub fn read_note(path: String) -> Result<NoteFile, String> {
    let p = Path::new(&path);
    let content = fs::read_to_string(p).map_err(|e| e.to_string())?;
    let meta = fs::metadata(p).map_err(|e| e.to_string())?;
    Ok(NoteFile {
        path: path.clone(),
        filename: p
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string(),
        content,
        modified_at: file_timestamp(&meta, true),
        created_at: file_timestamp(&meta, false),
    })
}

/// Write (create or update) a note file
#[tauri::command]
pub fn write_note(path: String, content: String) -> Result<(), String> {
    atomic_write(Path::new(&path), &content, true)
}

/// Create a note without ever replacing an existing file.
#[tauri::command]
pub fn create_note(path: String, content: String) -> Result<NoteFile, String> {
    let p = Path::new(&path);
    if p.exists() {
        return Err("A note with this name already exists.".to_string());
    }
    let parent = p
        .parent()
        .ok_or_else(|| "Note path has no parent folder.".to_string())?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(p)
        .map_err(|e| e.to_string())?;
    file.write_all(content.as_bytes())
        .map_err(|e| e.to_string())?;
    file.sync_all().map_err(|e| e.to_string())?;
    read_note(path)
}

/// Ensure a note file exists (create empty if not); return its content
#[tauri::command]
pub fn ensure_note_exists(path: String, default_content: String) -> Result<NoteFile, String> {
    let p = Path::new(&path);
    if !p.exists() {
        if let Some(parent) = p.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        fs::write(p, &default_content).map_err(|e| e.to_string())?;
    }
    read_note(path)
}

/// Move a note into the vault's recoverable trash instead of deleting it.
#[tauri::command]
pub fn delete_note(path: String, vault_path: String) -> Result<String, String> {
    let source = fs::canonicalize(&path).map_err(|e| e.to_string())?;
    let vault = fs::canonicalize(&vault_path).map_err(|e| e.to_string())?;
    if !source.starts_with(&vault) {
        return Err("Refusing to remove a note outside the active vault.".to_string());
    }
    let trash = vault.join(".manager-trash");
    fs::create_dir_all(&trash).map_err(|e| e.to_string())?;
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let filename = source.file_name().unwrap_or_default().to_string_lossy();
    let destination = trash.join(format!("{timestamp}-{filename}"));
    fs::rename(&source, &destination).map_err(|e| e.to_string())?;
    Ok(destination.to_string_lossy().into_owned())
}

/// Update a note's title and move it without a destructive write/delete pair.
#[tauri::command]
pub fn rename_note(path: String, new_path: String, content: String) -> Result<NoteFile, String> {
    let source = Path::new(&path);
    let destination = Path::new(&new_path);
    if source != destination && destination.exists() {
        return Err("A note with this name already exists.".to_string());
    }
    atomic_write(source, &content, true)?;
    if source != destination {
        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        fs::rename(source, destination).map_err(|e| e.to_string())?;
    }
    read_note(new_path)
}

/// List all .md files under a vault directory (recursive)
#[tauri::command]
pub fn list_notes(vault_path: String) -> Result<Vec<NoteStub>, String> {
    let base = PathBuf::from(&vault_path);
    if !base.exists() {
        fs::create_dir_all(&base).map_err(|e| e.to_string())?;
        return Ok(vec![]);
    }

    let mut notes = Vec::new();
    for entry in WalkDir::new(&base)
        .into_iter()
        .filter_entry(|entry| {
            entry.depth() == 0 || !entry.file_name().to_string_lossy().starts_with(".manager-")
        })
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("md") {
            let meta = match fs::metadata(path) {
                Ok(m) => m,
                Err(_) => continue,
            };
            notes.push(NoteStub {
                path: path.to_string_lossy().to_string(),
                filename: path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string(),
                modified_at: file_timestamp(&meta, true),
            });
        }
    }

    notes.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
    Ok(notes)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_vault(name: &str) -> PathBuf {
        let id = TEMP_COUNTER.fetch_add(1, Ordering::Relaxed);
        std::env::temp_dir().join(format!("manager-{name}-{}-{id}", std::process::id()))
    }

    #[test]
    fn writes_atomically_and_keeps_a_recovery_copy() {
        let vault = test_vault("write");
        let path = vault.join("Notes/Test.md");
        atomic_write(&path, "first", true).unwrap();
        atomic_write(&path, "second", true).unwrap();
        assert_eq!(fs::read_to_string(&path).unwrap(), "second");
        assert_eq!(
            fs::read_to_string(path.parent().unwrap().join(".manager-backups/Test.md.bak"))
                .unwrap(),
            "first",
        );
        let _ = fs::remove_dir_all(vault);
    }

    #[test]
    fn create_never_overwrites_an_existing_note() {
        let vault = test_vault("create");
        let path = vault.join("Notes/Test.md");
        create_note(path.to_string_lossy().into_owned(), "first".into()).unwrap();
        assert!(create_note(path.to_string_lossy().into_owned(), "second".into()).is_err());
        assert_eq!(fs::read_to_string(&path).unwrap(), "first");
        let _ = fs::remove_dir_all(vault);
    }

    #[test]
    fn deletion_moves_notes_out_of_the_index() {
        let vault = test_vault("trash");
        fs::create_dir_all(vault.join("Notes")).unwrap();
        let path = vault.join("Notes/Test.md");
        fs::write(&path, "recover me").unwrap();
        let trashed = delete_note(
            path.to_string_lossy().into_owned(),
            vault.to_string_lossy().into_owned(),
        )
        .unwrap();
        assert!(!path.exists());
        assert_eq!(fs::read_to_string(trashed).unwrap(), "recover me");
        assert!(list_notes(vault.to_string_lossy().into_owned())
            .unwrap()
            .is_empty());
        let _ = fs::remove_dir_all(vault);
    }
}

/// List top-level folders inside vault
#[tauri::command]
pub fn list_folders(vault_path: String) -> Result<Vec<FolderEntry>, String> {
    let base = PathBuf::from(&vault_path);
    if !base.exists() {
        return Ok(vec![]);
    }

    let mut folders = vec![];
    let entries = fs::read_dir(&base).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir()
            && !path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .starts_with(".manager-")
        {
            let note_count = WalkDir::new(&path)
                .into_iter()
                .filter_map(|e| e.ok())
                .filter(|e| e.path().extension().and_then(|x| x.to_str()) == Some("md"))
                .count();
            folders.push(FolderEntry {
                name: path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string(),
                path: path.to_string_lossy().to_string(),
                note_count,
            });
        }
    }

    Ok(folders)
}
