use std::path::PathBuf;

use serde::Serialize;

use crate::{
    db::{self, Database},
    domain::AppState,
    fs,
};

#[derive(Serialize)]
pub struct ResolvedDbPath {
    pub resolved_path: String,
    pub exists: bool,
}

#[derive(Serialize)]
pub struct RegisteredDbPath {
    pub name: String,
    pub relative_path: String,
    pub absolute_path: String,
}

async fn active_db_path(app_state: &AppState) -> Result<PathBuf, String> {
    let active = app_state.active_db_path.read().await;
    if let Some(path) = active.as_ref() {
        return Ok(path.clone());
    }

    Ok(Database::default_db_path(&app_state.default_db_dir))
}

#[tauri::command]
pub async fn get_app_data_dir(app_state: tauri::State<'_, AppState>) -> Result<String, String> {
    app_state
        .app_data_dir
        .to_str()
        .map(|value| value.to_string())
        .ok_or_else(|| "Invalid app data directory".to_string())
}

#[tauri::command]
pub async fn get_default_db_path(app_state: tauri::State<'_, AppState>) -> Result<String, String> {
    Database::default_db_path(&app_state.default_db_dir)
        .to_str()
        .map(|value| value.to_string())
        .ok_or_else(|| "Invalid default database path".to_string())
}

#[tauri::command]
pub async fn register_db_path(
    app_state: tauri::State<'_, AppState>,
    absolute_path: &str,
) -> Result<RegisteredDbPath, String> {
    let absolute = PathBuf::from(absolute_path);
    let name = absolute
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("Database")
        .to_string();

    Ok(RegisteredDbPath {
        name,
        relative_path: fs::relative_path_from_base(&app_state.app_data_dir, &absolute),
        absolute_path: absolute_path.to_string(),
    })
}

#[tauri::command]
pub async fn resolve_db_path(
    app_state: tauri::State<'_, AppState>,
    relative_path: &str,
    absolute_path: &str,
) -> Result<ResolvedDbPath, String> {
    let resolved = fs::resolve_db_path(&app_state.app_data_dir, relative_path, absolute_path);
    let resolved_string = resolved
        .to_str()
        .ok_or("Invalid resolved database path")?
        .to_string();

    Ok(ResolvedDbPath {
        resolved_path: resolved_string,
        exists: fs::db_file_exists(&resolved),
    })
}

#[tauri::command]
pub async fn set_active_db_path(
    app: tauri::AppHandle,
    app_state: tauri::State<'_, AppState>,
    db_path: &str,
) -> Result<(), String> {
    let path = PathBuf::from(db_path);
    fs::allow_directory_in_scope(&app, &path)?;

    let mut active = app_state.active_db_path.write().await;
    *active = Some(path);
    Ok(())
}

#[tauri::command]
pub async fn does_db_exist(app_state: tauri::State<'_, AppState>) -> Result<bool, String> {
    let db_path = active_db_path(&app_state).await?;
    Ok(fs::db_file_exists(&db_path))
}

#[tauri::command]
pub async fn is_db_ready(app_state: tauri::State<'_, AppState>) -> Result<bool, String> {
    let db_lock = app_state.db.read().await;
    let db = match db_lock.as_ref() {
        Some(db) => db,
        None => return Ok(false),
    };
    Ok(db.is_ready().await)
}

#[tauri::command]
pub fn did_auth_succeed(app_state: tauri::State<'_, AppState>) -> bool {
    app_state
        .did_auth_succeed
        .load(std::sync::atomic::Ordering::Relaxed)
}

#[tauri::command]
pub async fn init_db(
    app: tauri::AppHandle,
    app_state: tauri::State<'_, AppState>,
    encryption_key: &str,
    db_path: Option<String>,
) -> Result<(), String> {
    {
        let db_lock = app_state.db.read().await;
        if db_lock.is_some() {
            return Err(String::from("Database is already initialized."));
        }
    }

    let db_path = match db_path {
        Some(path) => {
            let path = PathBuf::from(path);
            fs::allow_directory_in_scope(&app, &path)?;
            let mut active = app_state.active_db_path.write().await;
            *active = Some(path.clone());
            path
        }
        None => active_db_path(&app_state).await?,
    };

    let db = db::Database::new(encryption_key, db_path.clone()).await?;
    if !fs::db_file_exists(&db_path) {
        return Err("Failed to create database file.".to_string());
    }

    let migration =
        db::migration::Migration::new(db.get_pool().clone(), app_state.migration_dir.clone());
    migration.run().await?;

    let mut db_state = app_state.db.write().await;
    *db_state = Some(db);
    app_state
        .did_auth_succeed
        .store(true, std::sync::atomic::Ordering::Relaxed);
    Ok(())
}

#[tauri::command]
pub async fn run_pending_migrations(app_state: tauri::State<'_, AppState>) -> Result<(), String> {
    let db_lock = app_state.db.read().await;
    let db = db_lock
        .as_ref()
        .ok_or("Database not initialized".to_string())?;
    let migration = db::migration::Migration::new(
        db.get_pool().clone(),
        app_state.migration_dir.clone(),
    );
    migration.run().await
}

#[tauri::command]
pub async fn logout_db(app_state: tauri::State<'_, AppState>) -> Result<(), String> {
    app_state
        .did_auth_succeed
        .store(false, std::sync::atomic::Ordering::Relaxed);

    let mut lock = app_state.db.write().await;
    if let Some(db) = lock.take() {
        db.close_pool().await;
    }

    Ok(())
}

#[tauri::command]
pub async fn reset_db(
    app_state: tauri::State<'_, AppState>,
    purge_data: bool,
) -> Result<(), String> {
    let db_path = active_db_path(&app_state).await?;

    {
        app_state
            .did_auth_succeed
            .store(false, std::sync::atomic::Ordering::Relaxed);
        let mut lock = app_state.db.write().await;
        match lock.take() {
            Some(db) => {
                if purge_data {
                    match db.reset().await {
                        Ok(_) => return Ok(()),
                        Err(err) => return Err(err.to_string()),
                    }
                } else {
                    db.close_pool().await
                }
            }
            None => {}
        }
    }

    if purge_data {
        Database::purge_data(&db_path)?;
    }
    Ok(())
}

#[derive(Serialize)]
pub struct ResolvedStoredPath {
    pub resolved_path: String,
    pub exists: bool,
}

#[tauri::command]
pub async fn get_prompts_dir(app_state: tauri::State<'_, AppState>) -> Result<String, String> {
    app_state
        .prompts_dir
        .to_str()
        .map(str::to_string)
        .ok_or_else(|| "Invalid prompts directory".to_string())
}

#[tauri::command]
pub async fn ensure_default_prompts(
    app_state: tauri::State<'_, AppState>,
) -> Result<Vec<String>, String> {
    fs::copy_bundled_prompts(
        &app_state.bundled_prompts_dir,
        &app_state.prompts_dir,
        false,
    )
}

#[tauri::command]
pub async fn reload_bundled_prompts(
    app_state: tauri::State<'_, AppState>,
) -> Result<Vec<String>, String> {
    fs::copy_bundled_prompts(
        &app_state.bundled_prompts_dir,
        &app_state.prompts_dir,
        true,
    )
}

#[tauri::command]
pub async fn resolve_stored_path(
    app_state: tauri::State<'_, AppState>,
    relative_path: &str,
    absolute_path: &str,
) -> Result<ResolvedStoredPath, String> {
    let resolved = fs::resolve_stored_path(
        &app_state.app_data_dir,
        relative_path,
        absolute_path,
    );
    let resolved_string = resolved
        .to_str()
        .ok_or("Invalid resolved path")?
        .to_string();

    Ok(ResolvedStoredPath {
        resolved_path: resolved_string,
        exists: fs::stored_file_exists(&resolved),
    })
}

#[tauri::command]
pub async fn read_text_file(
    app_state: tauri::State<'_, AppState>,
    relative_path: &str,
    absolute_path: &str,
) -> Result<String, String> {
    let path = fs::resolve_stored_path(
        &app_state.app_data_dir,
        relative_path,
        absolute_path,
    );

    std::fs::read_to_string(&path).map_err(|err| {
        format!("Failed to read {}: {}", path.display(), err)
    })
}

#[tauri::command]
pub async fn write_text_file(
    app: tauri::AppHandle,
    app_state: tauri::State<'_, AppState>,
    relative_path: &str,
    absolute_path: &str,
    content: &str,
) -> Result<(), String> {
    let path = fs::resolve_stored_path(
        &app_state.app_data_dir,
        relative_path,
        absolute_path,
    );

    fs::allow_directory_in_scope(&app, &path)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }

    std::fs::write(&path, content).map_err(|err| {
        format!("Failed to write {}: {}", path.display(), err)
    })
}
