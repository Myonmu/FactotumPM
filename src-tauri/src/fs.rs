use std::fs;
use std::path::{Path, PathBuf};

use tauri::Manager;
use tauri_plugin_fs::FsExt;

/// Create required db directory if it does not exist.
pub fn setup_db_dir(app: &mut tauri::App) -> Result<PathBuf, tauri::Error> {
    let app_data_directory = app.path().app_data_dir()?;

    fs::create_dir_all(&app_data_directory)?;

    let scope = app.fs_scope();
    scope.allow_directory(&app_data_directory, true)?;

    let db_dir = &app_data_directory.display().to_string();
    let db_path = PathBuf::from(db_dir).join("db");
    fs::create_dir_all(&db_path)?;

    Ok(db_path)
}

pub fn setup_prompts_dir(app: &mut tauri::App) -> Result<PathBuf, tauri::Error> {
    let app_data_directory = app.path().app_data_dir()?;
    let prompts_dir = app_data_directory.join("prompts");
    fs::create_dir_all(&prompts_dir)?;

    let scope = app.fs_scope();
    scope.allow_directory(&prompts_dir, true)?;

    Ok(prompts_dir)
}

pub fn setup_app_data_dir(app: &mut tauri::App) -> Result<PathBuf, tauri::Error> {
    let app_data_directory = app.path().app_data_dir()?;
    fs::create_dir_all(&app_data_directory)?;

    let scope = app.fs_scope();
    scope.allow_directory(&app_data_directory, true)?;

    Ok(app_data_directory)
}

pub fn delete_file_if_exists(path: &PathBuf) -> Result<(), String> {
    if path.exists() {
        fs::remove_file(path).map_err(|e| format!("Failed to delete {}: {}", path.display(), e))?;
    }
    Ok(())
}

pub fn relative_path_from_base(base: &Path, target: &Path) -> String {
    match target.strip_prefix(base) {
        Ok(relative) => relative
            .to_string_lossy()
            .replace('\\', "/"),
        Err(_) => String::new(),
    }
}

pub fn resolve_db_path(app_data_dir: &Path, relative_path: &str, absolute_path: &str) -> PathBuf {
    if !relative_path.is_empty() {
        let candidate = app_data_dir.join(relative_path);
        if candidate.exists() {
            return candidate;
        }
    }

    PathBuf::from(absolute_path)
}

pub fn resolve_stored_path(app_data_dir: &Path, relative_path: &str, absolute_path: &str) -> PathBuf {
    resolve_db_path(app_data_dir, relative_path, absolute_path)
}

pub fn db_file_exists(path: &Path) -> bool {
    stored_file_exists(path)
}

pub fn stored_file_exists(path: &Path) -> bool {
    path.is_file()
}

pub fn copy_bundled_prompts(bundled_dir: &Path, prompts_dir: &Path) -> Result<Vec<String>, String> {
    if !bundled_dir.exists() {
        return Ok(vec![]);
    }

    fs::create_dir_all(prompts_dir).map_err(|err| {
        format!(
            "Failed to create prompts directory {}: {}",
            prompts_dir.display(),
            err
        )
    })?;

    let mut copied = Vec::new();
    for entry in fs::read_dir(bundled_dir).map_err(|err| err.to_string())? {
        let entry = entry.map_err(|err| err.to_string())?;
        let source = entry.path();
        if !source.is_file() {
            continue;
        }

        if source.extension().and_then(|value| value.to_str()) != Some("md") {
            continue;
        }

        let file_name = entry.file_name();
        let destination = prompts_dir.join(&file_name);
        if !destination.exists() {
            fs::copy(&source, &destination).map_err(|err| {
                format!(
                    "Failed to copy prompt {}: {}",
                    source.display(),
                    err
                )
            })?;
        }

        copied.push(
            file_name
                .to_string_lossy()
                .replace('\\', "/"),
        );
    }

    Ok(copied)
}

pub fn ensure_parent_dir(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory {}: {}", parent.display(), e))?;
        }
    }
    Ok(())
}

pub fn allow_directory_in_scope(app: &tauri::AppHandle, path: &Path) -> Result<(), String> {
    ensure_parent_dir(path)?;
    if let Some(parent) = path.parent() {
        let scope = app.fs_scope();
        scope
            .allow_directory(parent, true)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
