use tauri::Emitter;
use std::collections::HashMap;

mod csv_handler;
mod pptx_engine;

use pptx_engine::GenConfig;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn read_csv_preview_cmd(path: String) -> Result<Vec<HashMap<String, String>>, String> {
    csv_handler::read_csv_preview(path, 5)
}

#[tauri::command]
async fn generate_presentations_cmd(app: tauri::AppHandle, config: GenConfig) -> Result<pptx_engine::GenStats, String> {
    let result = std::thread::spawn(move || {
        pptx_engine::generate_pptx(config, |progress, msg| {
             let _ = app.emit("progress", (progress, msg));
        })
    }).join();

    match result {
        Ok(res) => res,
        Err(_) => Err("Thread panicked".to_string())
    }
}

#[tauri::command]
fn scan_template_structure_cmd(path: String) -> Vec<String> {
    pptx_engine::get_available_languages(&path)
}

#[tauri::command]
fn validate_csv_cmd(path: String) -> bool {
    // We consider it valid if we can read 1 record
    csv_handler::read_csv_preview(path, 1).is_ok()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet, 
            read_csv_preview_cmd, 
            generate_presentations_cmd,
            scan_template_structure_cmd,
            validate_csv_cmd
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
