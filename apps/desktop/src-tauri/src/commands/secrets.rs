use std::ffi::{CStr, CString};
use std::os::raw::{c_char, c_int};

#[cfg(target_os = "macos")]
extern "C" {
    fn keychain_set(account: *const c_char, value: *const c_char) -> c_int;
    fn keychain_get(account: *const c_char) -> *mut c_char;
    fn keychain_delete(account: *const c_char) -> c_int;
    fn ek_free(ptr: *mut c_char);
}

fn validate_key(key: &str) -> Result<(), String> {
    match key {
        "gemini_api_key" | "todoist_access_token" | "manager_ai_access_token" => Ok(()),
        _ => Err("Unsupported secret key".to_string()),
    }
}

pub(crate) fn set_secret_value(key: &str, value: &str) -> Result<(), String> {
    set_secret(key.to_string(), value.to_string())
}

pub(crate) fn get_secret_value(key: &str) -> Result<String, String> {
    get_secret(key.to_string())
}

pub(crate) fn delete_secret_value(key: &str) -> Result<(), String> {
    delete_secret(key.to_string())
}

#[tauri::command]
pub fn set_secret(key: String, value: String) -> Result<(), String> {
    validate_key(&key)?;
    #[cfg(target_os = "macos")]
    unsafe {
        let key = CString::new(key).map_err(|_| "Invalid secret key")?;
        let value = CString::new(value).map_err(|_| "Secret contains invalid data")?;
        let status = keychain_set(key.as_ptr(), value.as_ptr());
        if status == 0 { Ok(()) } else { Err(format!("Keychain error {status}")) }
    }
    #[cfg(not(target_os = "macos"))]
    Err("Secure credential storage is not available on this platform".to_string())
}

#[tauri::command]
pub fn get_secret(key: String) -> Result<String, String> {
    validate_key(&key)?;
    #[cfg(target_os = "macos")]
    unsafe {
        let key = CString::new(key).map_err(|_| "Invalid secret key")?;
        let ptr = keychain_get(key.as_ptr());
        if ptr.is_null() { return Ok(String::new()); }
        let value = CStr::from_ptr(ptr).to_string_lossy().into_owned();
        ek_free(ptr);
        Ok(value)
    }
    #[cfg(not(target_os = "macos"))]
    Ok(String::new())
}

#[tauri::command]
pub fn delete_secret(key: String) -> Result<(), String> {
    validate_key(&key)?;
    #[cfg(target_os = "macos")]
    unsafe {
        let key = CString::new(key).map_err(|_| "Invalid secret key")?;
        let status = keychain_delete(key.as_ptr());
        if status == 0 { Ok(()) } else { Err(format!("Keychain error {status}")) }
    }
    #[cfg(not(target_os = "macos"))]
    Ok(())
}
