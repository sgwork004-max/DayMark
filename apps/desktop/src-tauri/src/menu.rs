//! Native macOS menu bar. Most items emit a `menu` event that the frontend
//! handles with the same commands as its keyboard shortcuts.

use tauri::menu::{Menu, MenuBuilder, MenuEvent, MenuItemBuilder, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Runtime};

const REPO_URL: &str = "https://github.com/sgwork004-max/manager";
const ISSUES_URL: &str = "https://github.com/sgwork004-max/manager/issues/new/choose";

fn item<R: Runtime>(
    app: &AppHandle<R>,
    id: &str,
    label: &str,
    accelerator: Option<&str>,
) -> tauri::Result<tauri::menu::MenuItem<R>> {
    let builder = MenuItemBuilder::with_id(id, label);
    match accelerator {
        Some(keys) => builder.accelerator(keys).build(app),
        None => builder.build(app),
    }
}

pub fn build<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let app_menu = SubmenuBuilder::new(app, "Manager")
        .about(None)
        .separator()
        .item(&item(app, "settings", "Settings…", Some("CmdOrCtrl+,"))?)
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;

    let file_menu = SubmenuBuilder::new(app, "File")
        .item(&item(app, "new-note", "New Note", Some("CmdOrCtrl+N"))?)
        .item(&item(app, "quick-task", "Quick Capture Task", Some("CmdOrCtrl+Shift+Space"))?)
        .separator()
        .item(&item(app, "import", "Import Notes…", None)?)
        .separator()
        .item(&item(app, "save", "Save", Some("CmdOrCtrl+S"))?)
        .close_window()
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    let view_menu = SubmenuBuilder::new(app, "View")
        .item(&item(app, "today", "Today", Some("CmdOrCtrl+T"))?)
        .item(&item(app, "yesterday", "Yesterday", Some("CmdOrCtrl+Y"))?)
        .item(&item(app, "tomorrow", "Tomorrow", Some("CmdOrCtrl+Shift+T"))?)
        .separator()
        .item(&item(app, "palette", "Command Palette", Some("CmdOrCtrl+K"))?)
        .item(&item(app, "review-day", "Close the Day", Some("CmdOrCtrl+Shift+E"))?)
        .separator()
        .item(&item(app, "calendar", "Calendar", Some("CmdOrCtrl+Shift+C"))?)
        .item(&item(app, "ai", "AI Assistant", Some("CmdOrCtrl+Shift+A"))?)
        .item(&item(app, "toc", "Table of Contents", Some("CmdOrCtrl+Shift+O"))?)
        .item(&item(app, "graph", "Graph View", Some("CmdOrCtrl+Shift+G"))?)
        .separator()
        .fullscreen()
        .build()?;

    let window_menu = SubmenuBuilder::new(app, "Window")
        .minimize()
        .maximize()
        .build()?;

    let help_menu = SubmenuBuilder::new(app, "Help")
        .item(&item(app, "shortcuts", "Keyboard Shortcuts", None)?)
        .separator()
        .item(&item(app, "report-issue", "Report an Issue…", None)?)
        .item(&item(app, "github", "Manager on GitHub", None)?)
        .build()?;

    MenuBuilder::new(app)
        .items(&[&app_menu, &file_menu, &edit_menu, &view_menu, &window_menu, &help_menu])
        .build()
}

pub fn handle<R: Runtime>(app: &AppHandle<R>, event: MenuEvent) {
    let id = event.id().as_ref();
    let url = match id {
        "report-issue" => Some(ISSUES_URL),
        "github" => Some(REPO_URL),
        _ => None,
    };
    if let Some(url) = url {
        // Fixed URLs only; nothing from the webview reaches this command.
        let _ = std::process::Command::new("/usr/bin/open").arg(url).spawn();
        return;
    }
    let _ = app.emit("menu", id);
}
