pub mod commands;
pub mod db;
pub mod domain;
pub mod fs;

#[cfg(debug_assertions)]
use std::path::PathBuf;
use std::sync::Arc;
#[cfg(not(debug_assertions))]
use tauri::path::BaseDirectory;
use tauri::Manager;
use tokio::sync::RwLock;
use crate::domain::AppState;
use tauri_plugin_store::Builder;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_fs::init()) // Make sure to initialize the fs plugin
        .setup(|app| {
            // Initialize filesystem first
            let db_dir = fs::setup_db_dir(app).map_err(|err| {
                eprintln!("Failed to setup database directory: {}", err);
                err
            }).unwrap_or_else(|_| std::path::PathBuf::from("."));

            #[cfg(not(debug_assertions))]
            let migration_dir = app.path().resolve("migrations", BaseDirectory::Resource)?;
            #[cfg(debug_assertions)]
            let migration_dir = PathBuf::new().join("migrations");

            let app_state = AppState {
                db: Arc::new(RwLock::new(None)),
                db_dir,
                migration_dir,
            };
            app.manage(app_state);

            // Log the paths for debugging
            // println!("Database directory: {:?}", app_state.db_dir);
            // println!("Migration directory: {:?}", app_state.migration_dir);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::does_db_exist,
            commands::is_db_ready,
            commands::init_db,
            commands::reset_db,
            db::proxy::execute_single_sql,
            db::proxy::execute_batch_sql,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}