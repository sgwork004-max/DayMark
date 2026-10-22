use serde::{Deserialize, Serialize};
use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use std::sync::Once;

// ─── EventKit FFI (Swift helper compiled by build.rs) ────────────────────────

extern "C" {
    fn ek_init();
    fn ek_authorization_status() -> i32;
    fn ek_events_json(from_ts: i64, to_ts: i64) -> *mut c_char;
    fn ek_calendars_json() -> *mut c_char;
    fn ek_create_event(
        title: *const c_char,
        start_iso: *const c_char,
        end_iso: *const c_char,
        calendar_id: *const c_char,
        notes: *const c_char,
        location: *const c_char,
        url: *const c_char,
        alarm_minutes: i32,
    ) -> *mut c_char;
    fn ek_free(ptr: *mut c_char);
}

static EK_INIT: Once = Once::new();

fn ensure_ek_init() {
    EK_INIT.call_once(|| unsafe { ek_init() });
}

// ─── Types ───────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CalendarEvent {
    pub id: String,
    pub title: String,
    #[serde(rename = "startISO")]
    pub start_iso: String,
    #[serde(rename = "endISO")]
    pub end_iso: String,
    pub calendar: String,
    pub is_all_day: bool,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CalendarOption {
    pub id: String,
    pub title: String,
    pub source: String,
    pub writable: bool,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

fn local_midnight_ts(date: chrono::NaiveDate) -> Result<i64, String> {
    use chrono::{Local, TimeZone};
    let local = Local.from_local_datetime(
        &date
            .and_hms_opt(0, 0, 0)
            .ok_or_else(|| "Invalid calendar date.".to_string())?,
    );
    local
        .single()
        .or_else(|| local.earliest())
        .map(|value| value.timestamp())
        .ok_or_else(|| "Calendar date does not exist in the local timezone.".to_string())
}

fn event_range(date_from: &str, date_to: &str) -> Result<(i64, i64), String> {
    let from = chrono::NaiveDate::parse_from_str(date_from, "%Y-%m-%d")
        .map_err(|_| "Calendar start date must use YYYY-MM-DD.".to_string())?;
    let to = chrono::NaiveDate::parse_from_str(date_to, "%Y-%m-%d")
        .map_err(|_| "Calendar end date must use YYYY-MM-DD.".to_string())?;
    if to < from {
        return Err("Calendar end date must not be before the start date.".to_string());
    }
    let day_after = to
        .succ_opt()
        .ok_or_else(|| "Calendar date range is too large.".to_string())?;
    Ok((local_midnight_ts(from)?, local_midnight_ts(day_after)?))
}

fn calendar_access_error() -> Option<String> {
    match unsafe { ek_authorization_status() } {
        4 => None,
        0 => Some("Calendar permission is waiting for a response. Approve DayMark, then retry.".to_string()),
        1 => Some("Calendar access is denied. Enable DayMark in System Settings → Privacy & Security → Calendars.".to_string()),
        2 => Some("Calendar access is restricted by macOS or device policy.".to_string()),
        3 => Some("DayMark only has write access. Full Calendar access is required to show events.".to_string()),
        _ => Some("Calendar permission is unavailable.".to_string()),
    }
}

fn take_c_string(ptr: *mut c_char) -> String {
    if ptr.is_null() {
        return String::new();
    }
    let s = unsafe { CStr::from_ptr(ptr) }
        .to_string_lossy()
        .into_owned();
    unsafe { ek_free(ptr) };
    s
}

fn to_cstring(value: &str) -> Result<CString, String> {
    CString::new(value).map_err(|_| "Value contains an invalid null byte.".to_string())
}

// ─── Tauri Commands ───────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_calendar_events(
    date_from: String,
    date_to: String,
) -> Result<Vec<CalendarEvent>, String> {
    // EventKit is called synchronously from a blocking thread.
    let (from_ts, to_ts) = event_range(&date_from, &date_to)?;

    let json = tauri::async_runtime::spawn_blocking(move || {
        ensure_ek_init();
        if let Some(error) = calendar_access_error() {
            return Err(error);
        }
        let ptr = unsafe { ek_events_json(from_ts, to_ts) };
        if ptr.is_null() {
            return Ok("[]".to_string());
        }
        let s = unsafe { CStr::from_ptr(ptr) }
            .to_string_lossy()
            .into_owned();
        unsafe { ek_free(ptr) };
        Ok(s)
    })
    .await
    .map_err(|e| format!("Calendar task failed: {e}"))??;

    // Parse the JSON array
    let raw: Vec<serde_json::Value> = serde_json::from_str(&json).unwrap_or_default();

    let events = raw
        .into_iter()
        .filter_map(|v| {
            Some(CalendarEvent {
                id: v["id"].as_str()?.to_string(),
                title: v["title"].as_str().unwrap_or("").to_string(),
                start_iso: v["startISO"].as_str()?.to_string(),
                end_iso: v["endISO"].as_str().unwrap_or("").to_string(),
                calendar: v["calendar"].as_str().unwrap_or("").to_string(),
                is_all_day: v["isAllDay"].as_bool().unwrap_or(false),
                notes: v["notes"].as_str().map(|s| s.to_string()),
            })
        })
        .collect();

    Ok(events)
}

#[tauri::command]
pub async fn create_calendar_event(
    title: String,
    start_iso: String,
    end_iso: String,
    calendar_id: String,
    notes: Option<String>,
    location: Option<String>,
    url: Option<String>,
    alarm_minutes: Option<i32>,
) -> Result<(), String> {
    let title_c = to_cstring(&title)?;
    let start_c = to_cstring(&start_iso)?;
    let end_c = to_cstring(&end_iso)?;
    let calendar_c = to_cstring(&calendar_id)?;
    let notes_c = to_cstring(notes.as_deref().unwrap_or(""))?;
    let location_c = to_cstring(location.as_deref().unwrap_or(""))?;
    let url_c = to_cstring(url.as_deref().unwrap_or(""))?;
    let alarm_minutes = alarm_minutes.unwrap_or(-1);

    let error = tauri::async_runtime::spawn_blocking(move || {
        ensure_ek_init();
        if let Some(error) = calendar_access_error() {
            return error;
        }
        let ptr = unsafe {
            ek_create_event(
                title_c.as_ptr(),
                start_c.as_ptr(),
                end_c.as_ptr(),
                calendar_c.as_ptr(),
                notes_c.as_ptr(),
                location_c.as_ptr(),
                url_c.as_ptr(),
                alarm_minutes,
            )
        };
        take_c_string(ptr)
    })
    .await
    .map_err(|e| format!("spawn_blocking: {e}"))?;

    if !error.is_empty() {
        return Err(error);
    }

    Ok(())
}

#[tauri::command]
pub async fn list_calendars() -> Result<Vec<CalendarOption>, String> {
    let json = tauri::async_runtime::spawn_blocking(|| {
        ensure_ek_init();
        if let Some(error) = calendar_access_error() {
            return Err(error);
        }
        let ptr = unsafe { ek_calendars_json() };
        Ok(take_c_string(ptr))
    })
    .await
    .map_err(|e| format!("Calendar task failed: {e}"))??;

    let raw: Vec<serde_json::Value> = serde_json::from_str(&json).unwrap_or_default();
    Ok(raw
        .into_iter()
        .filter_map(|v| Some(CalendarOption {
            id: v["id"].as_str()?.to_string(),
            title: v["title"].as_str()?.to_string(),
            source: v["source"].as_str().unwrap_or("On My Mac").to_string(),
            writable: v["writable"].as_bool().unwrap_or(false),
        }))
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_calendar_ranges() {
        assert!(event_range("2026-07-01", "2026-07-31").is_ok());
        assert!(event_range("2026-02-30", "2026-03-01").is_err());
        assert!(event_range("2026-07-31", "2026-07-01").is_err());
    }
}
