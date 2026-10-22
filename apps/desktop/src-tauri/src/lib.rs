mod commands;
mod menu;

use commands::sync::FileWatcherState;
use commands::vault::VaultState;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .menu(|app| menu::build(app))
        .on_menu_event(|app, event| menu::handle(app, event))
        .manage(FileWatcherState::new())
        .manage(VaultState::from_saved_settings())
        .invoke_handler(tauri::generate_handler![
            // Files
            commands::files::default_vault_path,
            commands::files::read_note,
            commands::files::write_note,
            commands::files::create_note,
            commands::files::list_notes,
            commands::files::ensure_note_exists,
            commands::files::delete_note,
            commands::files::rename_note,
            commands::files::list_folders,
            commands::vault::choose_vault_folder,
            commands::vault::choose_import_folder,
            // Calendar
            commands::calendar::get_calendar_events,
            commands::calendar::create_calendar_event,
            commands::calendar::list_calendars,
            // Voice dictation
            commands::speech::start_voice_dictation,
            commands::speech::get_voice_dictation_status,
            commands::speech::stop_voice_dictation,
            // AI
            commands::ai::gemini_generate,
            // Sync / settings
            commands::sync::icloud_vault_path,
            commands::sync::start_file_watcher,
            commands::sync::stop_file_watcher,
            commands::sync::save_settings,
            commands::sync::load_settings,
            commands::sync::read_note_from_disk,
            // Secure credentials
            commands::secrets::set_secret,
            commands::secrets::get_secret,
            commands::secrets::delete_secret,
            // Local crash reporting and support diagnostics
            commands::diagnostics::report_app_error,
            commands::diagnostics::get_diagnostics,
            commands::diagnostics::export_diagnostics,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
