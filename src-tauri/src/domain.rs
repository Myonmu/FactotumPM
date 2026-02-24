use tokio::sync::RwLock;

use crate::db::Database;
use std::{path::PathBuf, sync::Arc};
use std::sync::atomic::AtomicBool;

pub struct AppState {
    pub db: Arc<RwLock<Option<Database>>>,
    pub did_auth_succeed: AtomicBool,
    pub db_dir: PathBuf,
    pub migration_dir: PathBuf,
}
