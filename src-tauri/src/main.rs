#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod pi;

use pi::PiRegistry;
use tauri::AppHandle;

#[tauri::command]
fn create_session(
    app: AppHandle,
    registry: tauri::State<PiRegistry>,
    cwd: Option<String>,
) -> Result<String, String> {
    registry.create_session(&app, cwd)
}

#[tauri::command]
fn list_sessions(registry: tauri::State<PiRegistry>) -> Result<Vec<pi::SessionInfo>, String> {
    registry.list_sessions()
}

#[tauri::command]
fn send_prompt(
    registry: tauri::State<PiRegistry>,
    session_id: String,
    message: String,
) -> Result<String, String> {
    registry.prompt(&session_id, &message)
}

#[tauri::command]
fn send_steer(
    registry: tauri::State<PiRegistry>,
    session_id: String,
    message: String,
) -> Result<(), String> {
    registry.steer(&session_id, &message)
}

#[tauri::command]
fn send_follow_up(
    registry: tauri::State<PiRegistry>,
    session_id: String,
    message: String,
) -> Result<(), String> {
    registry.follow_up(&session_id, &message)
}

#[tauri::command]
fn abort_session(registry: tauri::State<PiRegistry>, session_id: String) -> Result<(), String> {
    registry.abort(&session_id)
}

#[tauri::command]
fn request_state(
    registry: tauri::State<PiRegistry>,
    session_id: String,
) -> Result<(), String> {
    registry.request_state(&session_id)
}

#[tauri::command]
fn request_models(
    registry: tauri::State<PiRegistry>,
    session_id: String,
) -> Result<(), String> {
    registry.request_models(&session_id)
}

#[tauri::command]
fn set_model(
    registry: tauri::State<PiRegistry>,
    session_id: String,
    provider: String,
    model_id: String,
) -> Result<(), String> {
    registry.set_model(&session_id, &provider, &model_id)
}

#[tauri::command]
fn cycle_model(registry: tauri::State<PiRegistry>, session_id: String) -> Result<(), String> {
    registry.cycle_model(&session_id)
}

#[tauri::command]
fn request_thinking_levels(
    registry: tauri::State<PiRegistry>,
    session_id: String,
) -> Result<(), String> {
    registry.request_thinking_levels(&session_id)
}

#[tauri::command]
fn set_thinking_level(
    registry: tauri::State<PiRegistry>,
    session_id: String,
    level: String,
) -> Result<(), String> {
    registry.set_thinking_level(&session_id, &level)
}

#[tauri::command]
fn app_info(registry: tauri::State<PiRegistry>) -> pi::AppInfo {
    pi::app_info(registry.session_count())
}

#[tauri::command]
fn get_events(
    registry: tauri::State<PiRegistry>,
    session_id: String,
    after: usize,
) -> Result<Vec<serde_json::Value>, String> {
    registry.get_events(&session_id, after)
}

#[tauri::command]
fn destroy_session(
    registry: tauri::State<PiRegistry>,
    session_id: String,
) -> Result<(), String> {
    registry.destroy(&session_id)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(PiRegistry::default())
        .invoke_handler(tauri::generate_handler![
            create_session,
            list_sessions,
            send_prompt,
            send_steer,
            send_follow_up,
            abort_session,
            request_state,
            request_models,
            set_model,
            cycle_model,
            request_thinking_levels,
            set_thinking_level,
            app_info,
            get_events,
            destroy_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running darwin");
}
