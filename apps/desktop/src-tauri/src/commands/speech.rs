use serde::{Deserialize, Serialize};
use std::ffi::CStr;
use std::os::raw::c_char;

extern "C" {
    fn speech_start() -> *mut c_char;
    fn speech_status_json() -> *mut c_char;
    fn speech_stop() -> *mut c_char;
    fn speech_free(ptr: *mut c_char);
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceDictationStatus {
    pub recording: bool,
    pub transcript: String,
    pub error: String,
}

fn take_string(ptr: *mut c_char) -> String {
    if ptr.is_null() {
        return String::new();
    }
    let value = unsafe { CStr::from_ptr(ptr) }.to_string_lossy().into_owned();
    unsafe { speech_free(ptr) };
    value
}

#[tauri::command]
pub async fn start_voice_dictation() -> Result<(), String> {
    let error = tauri::async_runtime::spawn_blocking(|| take_string(unsafe { speech_start() }))
        .await
        .map_err(|error| format!("Dictation task failed: {error}"))?;
    if error.is_empty() { Ok(()) } else { Err(error) }
}

#[tauri::command]
pub async fn get_voice_dictation_status() -> Result<VoiceDictationStatus, String> {
    let json = tauri::async_runtime::spawn_blocking(|| take_string(unsafe { speech_status_json() }))
        .await
        .map_err(|error| format!("Dictation task failed: {error}"))?;
    serde_json::from_str(&json).map_err(|error| format!("Invalid dictation status: {error}"))
}

#[tauri::command]
pub async fn stop_voice_dictation() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(|| take_string(unsafe { speech_stop() }))
        .await
        .map_err(|error| format!("Dictation task failed: {error}"))
}
