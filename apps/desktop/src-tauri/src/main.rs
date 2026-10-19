// Prevents console window on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    daymark_desktop_lib::run();
}
