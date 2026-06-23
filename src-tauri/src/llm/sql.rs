use crate::db::proxy::{bind_params, row_to_sql_row, SQLRow};
use crate::domain::AppState;
use sqlparser::ast::Statement;
use sqlparser::dialect::SQLiteDialect;
use sqlparser::parser::Parser;

const DEFAULT_MAX_ROWS: u32 = 100;

/// Strip markdown code fences sometimes pasted by LLMs into SQL blocks.
fn strip_markdown_fences(sql: &str) -> String {
    let mut trimmed = sql.trim();
    if trimmed.starts_with("```") {
        if let Some(end) = trimmed[3..].find("```") {
            let inner = trimmed[3..3 + end].trim_start();
            trimmed = inner
                .strip_prefix("sql")
                .or_else(|| inner.strip_prefix("SQL"))
                .unwrap_or(inner)
                .trim();
        }
    }
    trimmed.to_string()
}

/// Remove `--` and `/* */` comments while preserving string literals.
fn strip_sql_comments(sql: &str) -> String {
    let mut result = String::with_capacity(sql.len());
    let chars: Vec<char> = sql.chars().collect();
    let mut index = 0;

    while index < chars.len() {
        let ch = chars[index];

        if ch == '\'' {
            result.push(ch);
            index += 1;
            while index < chars.len() {
                let current = chars[index];
                result.push(current);
                if current == '\'' {
                    if index + 1 < chars.len() && chars[index + 1] == '\'' {
                        result.push(chars[index + 1]);
                        index += 2;
                        continue;
                    }
                    index += 1;
                    break;
                }
                index += 1;
            }
            continue;
        }

        if ch == '"' {
            result.push(ch);
            index += 1;
            while index < chars.len() {
                let current = chars[index];
                result.push(current);
                if current == '"' {
                    if index + 1 < chars.len() && chars[index + 1] == '"' {
                        result.push(chars[index + 1]);
                        index += 2;
                        continue;
                    }
                    index += 1;
                    break;
                }
                index += 1;
            }
            continue;
        }

        if ch == '-' && index + 1 < chars.len() && chars[index + 1] == '-' {
            index += 2;
            while index < chars.len() && chars[index] != '\n' {
                index += 1;
            }
            if index < chars.len() {
                result.push('\n');
                index += 1;
            }
            continue;
        }

        if ch == '/' && index + 1 < chars.len() && chars[index + 1] == '*' {
            index += 2;
            while index + 1 < chars.len() && !(chars[index] == '*' && chars[index + 1] == '/') {
                index += 1;
            }
            index = (index + 2).min(chars.len());
            continue;
        }

        result.push(ch);
        index += 1;
    }

    result
}

fn normalize_agent_sql(sql: &str) -> String {
    let without_fences = strip_markdown_fences(sql);
    let without_comments = strip_sql_comments(&without_fences);
    without_comments
        .lines()
        .map(str::trim_end)
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .trim_end_matches(';')
        .trim()
        .to_string()
}

fn validate_readonly_sql(sql: &str) -> Result<(), String> {
    let normalized = normalize_agent_sql(sql);
    if normalized.is_empty() {
        return Err("SQL query is empty".into());
    }

    let dialect = SQLiteDialect {};
    let statements = Parser::parse_sql(&dialect, &normalized).map_err(|err| err.to_string())?;

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

fn has_limit_clause(sql: &str) -> bool {
    let collapsed: String = sql
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_uppercase();
    collapsed.contains(" LIMIT ")
}

fn ensure_limit(sql: &str, max_rows: u32) -> String {
    if has_limit_clause(sql) {
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
    let normalized = normalize_agent_sql(&sql);
    validate_readonly_sql(&normalized)?;

    let row_limit = max_rows.unwrap_or(DEFAULT_MAX_ROWS).min(500);
    let bounded_sql = ensure_limit(&normalized, row_limit);

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

#[cfg(test)]
mod tests {
    use super::*;

    fn assert_valid(sql: &str) {
        validate_readonly_sql(sql).expect("expected SQL to validate");
    }

    #[test]
    fn normalize_strips_line_comments_and_fences() {
        let sql = r#"```sql
SELECT t.id
FROM task t
WHERE 1 = 1 -- inline comment
-- full line comment
LIMIT 3
```"#;
        let normalized = normalize_agent_sql(sql);
        assert!(!normalized.contains("--"));
        assert!(normalized.contains("SELECT t.id"));
        assert!(normalized.contains("LIMIT 3"));
    }

    #[test]
    fn accepts_task_suggestion_query_with_comments() {
        let sql = r#"SELECT t.id, t.title, d.name AS domain_name, t.complexity, t.effort, t.uncertainty
FROM task t
JOIN domain d ON t.domain_id = d.id
WHERE d.id NOT IN ('d1ddfa93-82c9-499a-bf28-27c5c022eac3', 'b7d36319-66b9-4d39-8422-2bc5d565e5c4')
AND t.task_status_id IN (SELECT id FROM task_status WHERE is_terminal = 0) -- Must be non-terminal status
-- Exclude tasks that have children, as we prefer actionable leaf tasks
AND NOT EXISTS (SELECT 1 FROM task child WHERE child.parent_task_id = t.id)
ORDER BY d.name, t.complexity DESC
LIMIT 3"#;
        assert_valid(sql);
    }

    #[test]
    fn sqlparser_accepts_comments_without_normalization() {
        let sql = r#"SELECT t.id FROM task t WHERE 1=1 -- comment
LIMIT 3"#;
        let dialect = SQLiteDialect {};
        Parser::parse_sql(&dialect, sql).expect("sqlparser should accept line comments");
    }

    #[test]
    fn ensure_limit_does_not_duplicate_when_limit_on_new_line() {
        let sql = "SELECT t.id FROM task t\nORDER BY t.id DESC\nLIMIT 3";
        let bounded = ensure_limit(sql, 50);
        assert_eq!(bounded.matches("LIMIT").count(), 1);
        assert!(!bounded.to_uppercase().contains("LIMIT 3 LIMIT"));
    }

    #[test]
    fn ensure_limit_appends_when_missing() {
        let sql = "SELECT id FROM task";
        let bounded = ensure_limit(sql, 50);
        assert!(bounded.ends_with("LIMIT 50"));
    }

    #[test]
    fn task_suggestion_query_keeps_single_limit_after_bounding() {
        let sql = r#"SELECT t.id, t.title, d.name AS domain_name, t.complexity, t.effort, t.uncertainty
FROM task t
JOIN domain d ON t.domain_id = d.id
WHERE d.id NOT IN ('d1ddfa93-82c9-499a-bf28-27c5c022eac3', 'b7d36319-66b9-4d39-8422-2bc5d565e5c4')
AND t.task_status_id IN (SELECT id FROM task_status WHERE is_terminal = 0)
AND NOT EXISTS (SELECT 1 FROM task child WHERE child.parent_task_id = t.id)
ORDER BY d.name, t.complexity DESC
LIMIT 3"#;
        assert_valid(sql);
        let bounded = ensure_limit(&normalize_agent_sql(sql), 50);
        assert_eq!(bounded.matches("LIMIT").count(), 1);
        assert!(bounded.ends_with("LIMIT 3"));
    }

    #[test]
    fn preserves_dash_dash_inside_string_literals() {
        let sql = "SELECT id FROM task WHERE title = 'foo -- bar'";
        let normalized = normalize_agent_sql(sql);
        assert!(normalized.contains("'foo -- bar'"));
        assert_valid(sql);
    }
}
