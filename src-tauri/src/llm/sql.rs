use crate::db::proxy::{bind_params, row_to_sql_row, SQLRow};
use crate::domain::AppState;
use sqlparser::ast::Statement;
use sqlparser::dialect::SQLiteDialect;
use sqlparser::parser::Parser;

const DEFAULT_MAX_ROWS: u32 = 100;

fn validate_readonly_sql(sql: &str) -> Result<(), String> {
    let trimmed = sql.trim();
    if trimmed.is_empty() {
        return Err("SQL query is empty".into());
    }

    let dialect = SQLiteDialect {};
    let statements = Parser::parse_sql(&dialect, trimmed).map_err(|err| err.to_string())?;

    if statements.is_empty() {
        return Err("SQL query parsed to zero statements".into());
    }

    if statements.len() > 1 {
        return Err("Only a single SELECT statement is allowed".into());
    }

    match &statements[0] {
        Statement::Query(_) => Ok(()),
        _ => Err("Only SELECT queries are allowed".into()),
    }
}

fn ensure_limit(sql: &str, max_rows: u32) -> String {
    let upper = sql.to_uppercase();
    if upper.contains(" LIMIT ") || upper.trim_end().ends_with(" LIMIT") {
        return sql.trim().to_string();
    }

    format!("{} LIMIT {}", sql.trim().trim_end_matches(';'), max_rows)
}

#[tauri::command]
pub async fn execute_readonly_sql(
    app_state: tauri::State<'_, AppState>,
    sql: String,
    max_rows: Option<u32>,
) -> Result<Vec<SQLRow>, String> {
    validate_readonly_sql(&sql)?;

    let row_limit = max_rows.unwrap_or(DEFAULT_MAX_ROWS).min(500);
    let bounded_sql = ensure_limit(&sql, row_limit);

    let db_ref = app_state.db.read().await;
    let db = db_ref
        .as_ref()
        .ok_or("Database not initialized".to_string())?;

    let mut query = sqlx::query(bounded_sql.as_str());
    query = bind_params(query, &[]);

    let rows = query
        .fetch_all(db.get_pool())
        .await
        .map_err(|err| err.to_string())?;

    Ok(rows.iter().map(row_to_sql_row).collect())
}
