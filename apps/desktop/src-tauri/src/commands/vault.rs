//! Confines native file access to the active vault.
//!
//! The webview never decides on its own which folder DayMark may touch. A vault
//! becomes active only when it comes from the saved settings at launch, is one
//! of the built-in local or iCloud locations, or was picked by the user in a
//! native folder dialog. Import folders follow the same rule and are read-only.

use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

use super::files::default_vault_path;
use super::sync::{icloud_vault_path, saved_vault_path};

#[derive(Default)]
struct VaultAccess {
    root: Option<PathBuf>,
    /// Folders the user picked in a native dialog that may become the vault.
    picked_vaults: Vec<PathBuf>,
    /// Folders the user picked for import. Read-only.
    import_roots: Vec<PathBuf>,
}

pub struct VaultState(Mutex<VaultAccess>);

impl VaultState {
    /// Start with the vault from saved settings, or the default location.
    pub fn from_saved_settings() -> Self {
        let path = saved_vault_path().unwrap_or_else(default_vault_path);
        let access = VaultAccess {
            root: open_root(Path::new(&path)).ok(),
            ..Default::default()
        };
        Self(Mutex::new(access))
    }

    pub fn root(&self) -> Result<PathBuf, String> {
        self.0
            .lock()
            .unwrap()
            .root
            .clone()
            .ok_or_else(|| "No vault is open.".to_string())
    }

    /// Switch the active vault if the user approved this folder.
    pub fn activate(&self, requested: &str) -> Result<(), String> {
        let requested_path = Path::new(requested);
        let mut access = self.0.lock().unwrap();
        let unchanged = access
            .root
            .as_ref()
            .map_or(false, |root| fs::canonicalize(requested_path).ok().as_ref() == Some(root));
        if unchanged {
            return Ok(());
        }
        let approved = requested == default_vault_path()
            || requested == icloud_vault_path()
            || access.picked_vaults.iter().any(|picked| picked == requested_path);
        if !approved {
            return Err("Choose the vault folder from Settings.".to_string());
        }
        access.root = Some(open_root(requested_path)?);
        Ok(())
    }

    /// Resolve a path the app wants to read or write. It must be inside the vault.
    pub fn resolve(&self, path: &str) -> Result<PathBuf, String> {
        let root = self.root()?;
        resolve_within(&root, Path::new(path))
            .ok_or_else(|| "Refusing to access a file outside the active vault.".to_string())
    }

    /// Resolve a path for reading. It may be inside the vault or an import folder.
    pub fn resolve_readable(&self, path: &str) -> Result<PathBuf, String> {
        let access = self.0.lock().unwrap();
        let candidate = Path::new(path);
        access
            .root
            .iter()
            .chain(access.import_roots.iter())
            .find_map(|root| resolve_within(root, candidate))
            .ok_or_else(|| "Refusing to read a file outside the vault or import folder.".to_string())
    }
}

fn open_root(path: &Path) -> Result<PathBuf, String> {
    fs::create_dir_all(path).map_err(|e| e.to_string())?;
    fs::canonicalize(path).map_err(|e| e.to_string())
}

/// Return the real location of `path` if it stays inside `root`.
///
/// The longest existing ancestor is canonicalized so that symlinks pointing out
/// of the vault are caught. The part that does not exist yet may not contain
/// `..` or other non-normal components.
fn resolve_within(root: &Path, path: &Path) -> Option<PathBuf> {
    if !path.is_absolute()
        || path
            .components()
            .any(|component| matches!(component, Component::ParentDir | Component::CurDir))
    {
        return None;
    }
    let mut existing = path;
    let mut missing = Vec::new();
    while fs::symlink_metadata(existing).is_err() {
        missing.push(existing.file_name()?);
        existing = existing.parent()?;
    }
    let mut resolved = fs::canonicalize(existing).ok()?;
    for part in missing.into_iter().rev() {
        resolved.push(part);
    }
    resolved.starts_with(root).then_some(resolved)
}

fn pick_folder(app: &AppHandle, title: &str) -> Option<PathBuf> {
    app.dialog()
        .file()
        .set_title(title)
        .blocking_pick_folder()
        .and_then(|folder| folder.into_path().ok())
}

/// Let the user choose a vault folder in a native dialog.
#[tauri::command]
pub async fn choose_vault_folder(
    app: AppHandle,
    state: State<'_, VaultState>,
) -> Result<Option<String>, String> {
    let Some(folder) = pick_folder(&app, "Choose vault folder") else {
        return Ok(None);
    };
    state.0.lock().unwrap().picked_vaults.push(folder.clone());
    Ok(Some(folder.to_string_lossy().into_owned()))
}

/// Let the user choose a folder of Markdown files to import.
#[tauri::command]
pub async fn choose_import_folder(
    app: AppHandle,
    state: State<'_, VaultState>,
) -> Result<Option<String>, String> {
    let Some(folder) = pick_folder(&app, "Choose folder to import") else {
        return Ok(None);
    };
    let root = fs::canonicalize(&folder).map_err(|e| e.to_string())?;
    state.0.lock().unwrap().import_roots.push(root);
    Ok(Some(folder.to_string_lossy().into_owned()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_root(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("manager-vault-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("vault/Notes")).unwrap();
        fs::canonicalize(dir).unwrap()
    }

    #[test]
    fn allows_existing_and_new_paths_inside_the_vault() {
        let base = temp_root("inside");
        let vault = base.join("vault");
        fs::write(vault.join("Notes/a.md"), "a").unwrap();
        assert!(resolve_within(&vault, &vault.join("Notes/a.md")).is_some());
        assert!(resolve_within(&vault, &vault.join("Daily/20261019.md")).is_some());
        let _ = fs::remove_dir_all(base);
    }

    #[test]
    fn rejects_paths_outside_the_vault() {
        let base = temp_root("outside");
        let vault = base.join("vault");
        fs::write(base.join("secret.txt"), "x").unwrap();
        assert!(resolve_within(&vault, &base.join("secret.txt")).is_none());
        assert!(resolve_within(&vault, &vault.join("../secret.txt")).is_none());
        assert!(resolve_within(&vault, &vault.join("Notes/../../secret.txt")).is_none());
        assert!(resolve_within(&vault, Path::new("Notes/a.md")).is_none());
        assert!(resolve_within(&vault, &base.join("vault-other/a.md")).is_none());
        let _ = fs::remove_dir_all(base);
    }

    #[test]
    fn rejects_symlinks_that_leave_the_vault() {
        let base = temp_root("symlink");
        let vault = base.join("vault");
        fs::create_dir_all(base.join("elsewhere")).unwrap();
        fs::write(base.join("elsewhere/secret.md"), "x").unwrap();
        std::os::unix::fs::symlink(base.join("elsewhere"), vault.join("link")).unwrap();
        assert!(resolve_within(&vault, &vault.join("link/secret.md")).is_none());
        assert!(resolve_within(&vault, &vault.join("link/new.md")).is_none());
        let _ = fs::remove_dir_all(base);
    }

    #[test]
    fn only_approved_folders_become_the_vault() {
        let base = temp_root("activate");
        let state = VaultState(Mutex::new(VaultAccess {
            root: Some(base.join("vault")),
            ..Default::default()
        }));
        let other = base.join("other");
        assert!(state.activate(&other.to_string_lossy()).is_err());
        state.0.lock().unwrap().picked_vaults.push(other.clone());
        state.activate(&other.to_string_lossy()).unwrap();
        assert_eq!(state.root().unwrap(), fs::canonicalize(&other).unwrap());
        let _ = fs::remove_dir_all(base);
    }
}
