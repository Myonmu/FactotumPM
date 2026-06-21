pub mod commands;
pub mod db;
pub mod domain;
pub mod fs;
pub mod llm;

#[cfg(debug_assertions)]
use std::path::PathBuf;
use std::sync::{atomic, Arc};
#[cfg(not(debug_assertions))]
use tauri::path::BaseDirectory;
use tauri::Manager;
use tokio::sync::RwLock;

use crate::domain::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let app_data_dir = fs::setup_app_data_dir(app).map_err(|err| {
                eprintln!("Failed to setup app data directory: {}", err);
                err
            })?;

            let default_db_dir = fs::setup_db_dir(app).map_err(|err| {
                eprintln!("Failed to setup database directory: {}", err);
                err
            })?;

            let prompts_dir = fs::setup_prompts_dir(app).map_err(|err| {
                eprintln!("Failed to setup prompts directory: {}", err);
                err
            })?;

            #[cfg(not(debug_assertions))]
            let migration_dir = app.path().resolve("migrations", BaseDirectory::Resource)?;
            #[cfg(debug_assertions)]
            let migration_dir = PathBuf::new().join("migrations");

            #[cfg(not(debug_assertions))]
            let bundled_prompts_dir = app.path().resolve("prompts", BaseDirectory::Resource)?;
            #[cfg(debug_assertions)]
            let bundled_prompts_dir = PathBuf::new().join("../static/prompts");

            let app_state = AppState {
                db: Arc::new(RwLock::new(None)),
                did_auth_succeed: atomic::AtomicBool::new(false),
                app_data_dir,
                default_db_dir,
                prompts_dir,
                bundled_prompts_dir,
                active_db_path: Arc::new(RwLock::new(None)),
                migration_dir,
            };
            app.manage(app_state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_app_data_dir,
            commands::get_default_db_path,
            commands::register_db_path,
            commands::resolve_db_path,
            commands::set_active_db_path,
            commands::does_db_exist,
            commands::is_db_ready,
            commands::init_db,
            commands::run_pending_migrations,
            commands::reset_db,
            commands::logout_db,
            commands::did_auth_succeed,
            db::proxy::execute_single_sql,
            db::proxy::execute_batch_sql,
            llm::client::llm_chat,
            llm::client::llm_test_connection,
            llm::client::llm_list_models,
            llm::sql::execute_readonly_sql,
            commands::get_prompts_dir,
            commands::ensure_default_prompts,
            commands::resolve_stored_path,
            commands::read_text_file,
            commands::write_text_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
