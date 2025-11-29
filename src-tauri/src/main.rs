// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;
mod crypto;
mod models;

use models::{PasswordEntry, MasterPasswordCheck};
use std::sync::Mutex;
use tauri::State;

struct AppState {
    db_path: String,
    master_key: Mutex<Option<Vec<u8>>>,
}

#[tauri::command]
fn check_master_password_exists(state: State<AppState>) -> Result<bool, String> {
    db::check_master_password_exists(&state.db_path)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn setup_master_password(state: State<AppState>, password: String) -> Result<(), String> {
    db::setup_master_password(&state.db_path, &password)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn verify_master_password(state: State<AppState>, password: String) -> Result<bool, String> {
    let is_valid = db::verify_master_password(&state.db_path, &password)
        .map_err(|e| e.to_string())?;

    if is_valid {
        let key = crypto::derive_key(&password);
        let mut master_key = state.master_key.lock().unwrap();
        *master_key = Some(key);
    }

    Ok(is_valid)
}

#[tauri::command]
fn lock_app(state: State<AppState>) -> Result<(), String> {
    let mut master_key = state.master_key.lock().unwrap();
    *master_key = None;
    Ok(())
}

#[tauri::command]
fn is_unlocked(state: State<AppState>) -> Result<bool, String> {
    let master_key = state.master_key.lock().unwrap();
    Ok(master_key.is_some())
}

#[tauri::command]
fn add_password(
    state: State<AppState>,
    title: String,
    username: String,
    password: String,
    url: Option<String>,
    notes: Option<String>,
) -> Result<i64, String> {
    let master_key = state.master_key.lock().unwrap();
    let key = master_key.as_ref().ok_or("App is locked")?;

    db::add_password(&state.db_path, key, title, username, password, url, notes)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_all_passwords(state: State<AppState>) -> Result<Vec<PasswordEntry>, String> {
    let master_key = state.master_key.lock().unwrap();
    let key = master_key.as_ref().ok_or("App is locked")?;

    db::get_all_passwords(&state.db_path, key)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_password(state: State<AppState>, id: i64) -> Result<PasswordEntry, String> {
    let master_key = state.master_key.lock().unwrap();
    let key = master_key.as_ref().ok_or("App is locked")?;

    db::get_password(&state.db_path, key, id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn update_password(
    state: State<AppState>,
    id: i64,
    title: String,
    username: String,
    password: String,
    url: Option<String>,
    notes: Option<String>,
) -> Result<(), String> {
    let master_key = state.master_key.lock().unwrap();
    let key = master_key.as_ref().ok_or("App is locked")?;

    db::update_password(&state.db_path, key, id, title, username, password, url, notes)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_password(state: State<AppState>, id: i64) -> Result<(), String> {
    db::delete_password(&state.db_path, id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn search_passwords(state: State<AppState>, query: String) -> Result<Vec<PasswordEntry>, String> {
    let master_key = state.master_key.lock().unwrap();
    let key = master_key.as_ref().ok_or("App is locked")?;

    db::search_passwords(&state.db_path, key, &query)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn generate_password(
    length: usize,
    use_uppercase: bool,
    use_lowercase: bool,
    use_numbers: bool,
    use_symbols: bool,
) -> Result<String, String> {
    crypto::generate_password(length, use_uppercase, use_lowercase, use_numbers, use_symbols)
        .map_err(|e| e.to_string())
}

fn main() {
    let db_path = dirs::data_dir()
        .map(|mut path| {
            path.push("PassKeeper");
            std::fs::create_dir_all(&path).ok();
            path.push("passwords.db");
            path.to_string_lossy().to_string()
        })
        .unwrap_or_else(|| "passwords.db".to_string());

    db::initialize_database(&db_path).expect("Failed to initialize database");

    let app_state = AppState {
        db_path,
        master_key: Mutex::new(None),
    };

    tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            check_master_password_exists,
            setup_master_password,
            verify_master_password,
            lock_app,
            is_unlocked,
            add_password,
            get_all_passwords,
            get_password,
            update_password,
            delete_password,
            search_passwords,
            generate_password,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
