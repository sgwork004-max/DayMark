fn main() {
    #[cfg(target_os = "macos")]
    macos_setup();

    tauri_build::build()
}

#[cfg(target_os = "macos")]
fn macos_setup() {
    use std::process::Command;

    let out_dir = std::env::var("OUT_DIR").unwrap();

    // ── 1. Embed Info.plist in the binary ────────────────────────────────────
    // This is critical: macOS reads the __TEXT,__info_plist section to find
    // NSCalendarsFullAccessUsageDescription before showing the TCC permission dialog.
    // Without it the dialog silently never appears.
    let info_plist = r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleIdentifier</key>
  <string>co.daymark.desktop</string>
  <key>CFBundleName</key>
  <string>DayMark</string>
  <key>NSCalendarsUsageDescription</key>
  <string>DayMark reads your calendar events to show them alongside your notes and daily plans.</string>
  <key>NSCalendarsFullAccessUsageDescription</key>
  <string>DayMark reads your calendar events to show them alongside your notes and daily plans.</string>
  <key>NSMicrophoneUsageDescription</key>
  <string>DayMark uses the microphone only while you dictate a note.</string>
  <key>NSSpeechRecognitionUsageDescription</key>
  <string>DayMark converts your spoken words into text inside the current note.</string>
</dict>
</plist>"#;

    let info_path = format!("{out_dir}/Info.plist");
    std::fs::write(&info_path, info_plist).expect("write Info.plist");
    // Embed as __TEXT,__info_plist — macOS reads this for non-bundled binaries
    println!("cargo:rustc-link-arg=-Wl,-sectcreate,__TEXT,__info_plist,{info_path}");

    // ── 2. Compile Swift EventKit helper ─────────────────────────────────────
    println!("cargo:rerun-if-changed=src/calendar_kit.swift");
    println!("cargo:rerun-if-changed=src/speech_kit.swift");

    let obj_path = format!("{out_dir}/calendar_kit.o");

    let arch = std::env::var("CARGO_CFG_TARGET_ARCH").unwrap_or_default();
    let target_triple = if arch == "aarch64" {
        "arm64-apple-macosx13.0"
    } else {
        "x86_64-apple-macosx13.0"
    };

    let sdk = Command::new("xcrun")
        .args(["--show-sdk-path", "--sdk", "macosx"])
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_default();

    let module_cache = format!("{out_dir}/clang-module-cache");
    std::fs::create_dir_all(&module_cache).expect("create clang module cache");

    let status = Command::new("xcrun")
        .env("CLANG_MODULE_CACHE_PATH", &module_cache)
        .args([
            "--sdk", "macosx",
            "swiftc",
            "-c", "src/calendar_kit.swift",
            "-o", &obj_path,
            "-target", target_triple,
            "-sdk", &sdk,
            "-module-name", "CalendarKit",
            "-parse-as-library",
            "-Onone",
        ])
        .status()
        .expect("swiftc not found — install Xcode Command Line Tools");

    assert!(status.success(), "calendar_kit.swift compilation failed");

    let speech_obj_path = format!("{out_dir}/speech_kit.o");
    let speech_status = Command::new("xcrun")
        .env("CLANG_MODULE_CACHE_PATH", &module_cache)
        .args([
            "--sdk", "macosx",
            "swiftc",
            "-c", "src/speech_kit.swift",
            "-o", &speech_obj_path,
            "-target", target_triple,
            "-sdk", &sdk,
            "-module-name", "SpeechKit",
            "-parse-as-library",
            "-Onone",
        ])
        .status()
        .expect("swiftc not found — install Xcode Command Line Tools");

    assert!(speech_status.success(), "speech_kit.swift compilation failed");

    println!("cargo:rustc-link-arg={obj_path}");
    println!("cargo:rustc-link-arg={speech_obj_path}");
    println!("cargo:rustc-link-lib=framework=EventKit");
    println!("cargo:rustc-link-lib=framework=Speech");
    println!("cargo:rustc-link-lib=framework=AVFoundation");
    println!("cargo:rustc-link-lib=framework=Foundation");
    println!("cargo:rustc-link-lib=framework=Security");

    let swift_lib_path = Command::new("xcrun")
        .args(["--sdk", "macosx", "swiftc", "-print-runtime-lib-path"])
        .output()
        .ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_default();

    if !swift_lib_path.is_empty() {
        println!("cargo:rustc-link-search={swift_lib_path}");
    }

    println!("cargo:rustc-link-lib=dylib=swift_Concurrency");
    println!("cargo:rustc-link-arg=-Wl,-rpath,/usr/lib/swift");
}
