mod commands;

use commands::sync::FileWatcherState;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .manage(FileWatcherState::new())
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
            // Calendar
            commands::calendar::get_calendar_events,
            commands::calendar::create_calendar_event,
            commands::calendar::list_calendars,
            // Voice dictation
            commands::speech::start_voice_dictation,
            commands::speech::get_voice_dictation_status,
            commands::speech::stop_voice_dictation,
            // Todoist
            commands::todoist::get_todoist_today_tasks,
            commands::todoist::get_todoist_project_boards,
            commands::todoist::close_todoist_task,
            commands::todoist::create_todoist_task,
            // AI
            commands::ai::gemini_generate,
            commands::ai::activate_manager_ai,
            commands::ai::get_manager_ai_status,
            commands::ai::disconnect_manager_ai,
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
