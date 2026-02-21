use std::fs;
use std::path::PathBuf;
use tauri::Manager;
use tauri_plugin_fs::FsExt;

/// Create required db directory if it does not exist.
pub fn setup_db_dir(app: &mut tauri::App) -> Result<PathBuf, tauri::Error> {
    // First check if the app_data_dir exists, if not create it
    let app_data_directory = app.path().app_data_dir()?;

    // Ensure the directory exists before trying to scope it
    fs::create_dir_all(&app_data_directory)?;

    // Only now we can safely use the scope
    let scope = app.fs_scope();
    scope.allow_directory(&app_data_directory, true)?;

    let db_dir = &app_data_directory.display().to_string();

    // Create db subdirectory specifically for our database files
    let db_path = PathBuf::from(db_dir).join("db");
    fs::create_dir_all(&db_path)?;

    Ok(db_path)
}

pub fn delete_file_if_exists(path: &PathBuf) -> Result<(), String> {
    if path.exists() {
        fs::remove_file(path).map_err(|e| format!("Failed to delete {}: {}", path.display(), e))?;
    }
    Ok(())
}