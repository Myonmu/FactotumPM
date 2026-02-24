use crate::{
    db::{self, Database},
    domain::AppState,
};

#[tauri::command]
pub async fn does_db_exist(app_state: tauri::State<'_, AppState>) -> Result<bool, String> {
    // Ensure the database directory exists first
    let db_path = app_state.db_dir.join(Database::DEFAULT_DB_NAME);

    // Check if the file exists
    Ok(db_path.exists())
}

#[tauri::command]
pub async fn is_db_ready(app_state: tauri::State<'_, AppState>) -> Result<bool, String> {
    let db_lock = app_state.db.read().await;
    let db = match db_lock.as_ref() {
        Some(_db) => _db,
        _ => return Ok(false),
    };
    Ok(db.is_ready().await)
}

#[tauri::command]
pub fn did_auth_succeed(app_state: tauri::State<'_, AppState>) -> bool {
    app_state.did_auth_succeed.load(std::sync::atomic::Ordering::Relaxed)
}

#[tauri::command]
pub async fn init_db(
    app_state: tauri::State<'_, AppState>,
    encryption_key: &str,
) -> Result<(), String> {
    // First, ensure the database directory exists
    if !app_state.db_dir.exists() {
        std::fs::create_dir_all(&app_state.db_dir).map_err(|e| format!("Failed to create db directory: {}", e))?;
    }

    {
        let db_lock = app_state.db.read().await;
        if db_lock.is_some() {
            return Err(String::from("Database is already initialized."));
        }
    }

    let db = db::Database::new(encryption_key, app_state.db_dir.clone()).await?;
    let migration =
        db::migration::Migration::new(db.get_pool().clone(), app_state.migration_dir.clone());
    migration.run().await?;

    let mut db_state = app_state.db.write().await;
    *db_state = Some(db);
    app_state.did_auth_succeed.store(true, std::sync::atomic::Ordering::Relaxed);
    Ok(())
}

#[tauri::command]
pub async fn reset_db(
    app_state: tauri::State<'_, AppState>,
    purge_data: bool,
) -> Result<(), String> {
    {
        app_state.did_auth_succeed.store(false, std::sync::atomic::Ordering::Relaxed);
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
            _ => {}
        }
    };

    if purge_data {
        Database::purge_data(&app_state.db_dir)?;
    }
    Ok(())
}