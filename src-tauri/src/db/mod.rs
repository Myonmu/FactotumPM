pub mod migration;
pub mod proxy;

use std::{path::PathBuf, str::FromStr};

use sqlx::{
    self,
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
};

use crate::db::migration::Migration;

pub type DatabaseDialect = sqlx::Sqlite;
pub type DatabasePool = sqlx::Pool<DatabaseDialect>;

pub struct Database {
    db_path: PathBuf,
    pool: DatabasePool,
}

impl Database {
    pub const DEFAULT_DB_NAME: &'static str = "FactotumPM.db";

    pub fn default_db_path(db_dir: &PathBuf) -> PathBuf {
        db_dir.join(Self::DEFAULT_DB_NAME)
    }

    pub async fn new(password: &str, db_path: PathBuf) -> Result<Self, String> {
        if let Some(parent) = db_path.parent() {
            if !parent.exists() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create db directory: {}", e))?;
            }
        }

        let connect_options =
            SqliteConnectOptions::from_str(&db_path.to_str().ok_or("Invalid db path")?)
                .map_err(|err| err.to_string())?
                .pragma("key", password.to_string())
                .pragma("journal_mode", "WAL".to_string())
                .pragma("synchronous", "NORMAL".to_string())
                .pragma("busy_timeout", "5000".to_string())
                .create_if_missing(true);

        let pool = SqlitePoolOptions::new()
            .connect_with(connect_options)
            .await
            .map_err(|err| err.to_string())?;

        Migration::setup_migration_table(&pool)
            .await
            .map_err(|err| err.to_string())?;

        Ok(Self { pool, db_path })
    }

    pub fn get_pool(&self) -> &DatabasePool {
        &self.pool
    }

    pub fn db_path(&self) -> &PathBuf {
        &self.db_path
    }

    pub async fn close_pool(&self) {
        self.pool.close().await
    }

    pub async fn is_ready(&self) -> bool {
        let row: Option<i32> = sqlx::query_scalar(
            format!(
                "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='{}';",
                Migration::MIGRATION_TABLE_NAME
            )
            .as_str(),
        )
        .fetch_one(self.get_pool())
        .await
        .ok();

        if let Some(count) = row {
            return count == 1;
        }
        false
    }

    pub async fn reset(&self) -> Result<(), String> {
        self.close_pool().await;
        Self::purge_data(&self.db_path)?;
        Ok(())
    }

    pub fn purge_data(db_path: &PathBuf) -> Result<(), String> {
        let file_name = db_path
            .file_name()
            .and_then(|name| name.to_str())
            .ok_or("Invalid database path")?;

        if let Some(parent) = db_path.parent() {
            let entries = std::fs::read_dir(parent)
                .map_err(|e| format!("Failed to read db directory: {}", e))?;
            for entry in entries {
                let entry = entry.map_err(|e| e.to_string())?;
                let path = entry.path();

                if let Some(fname) = path.file_name().and_then(|n| n.to_str()) {
                    if fname.starts_with(file_name) {
                        std::fs::remove_file(&path)
                            .map_err(|e| format!("Failed to delete {}: {}", fname, e))?;
                    }
                }
            }
        }

        Ok(())
    }
}
