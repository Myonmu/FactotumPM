use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;

use tokio::sync::RwLock;

use crate::db::Database;

pub struct AppState {
    pub db: Arc<RwLock<Option<Database>>>,
    pub did_auth_succeed: AtomicBool,
    pub app_data_dir: PathBuf,
    pub default_db_dir: PathBuf,
    pub prompts_dir: PathBuf,
    pub bundled_prompts_dir: PathBuf,
    pub active_db_path: Arc<RwLock<Option<PathBuf>>>,
    pub migration_dir: PathBuf,
}
