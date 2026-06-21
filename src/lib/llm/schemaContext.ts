export const FACTOTUM_SCHEMA_CONTEXT = `
SQLite schema for FactotumPM (personal stamina-oriented project management):

Tables:
- task(id TEXT PK, title TEXT, description TEXT, detail TEXT,
       uncertainty/complexity/effort INTEGER 1-10,
       uncertainty_can_estimate/complexity_can_estimate/effort_can_estimate INTEGER null=unset 0=unknown 1=has value,
       domain_id TEXT FK domain.id, color INTEGER,
       parent_task_id TEXT FK task.id, is_trophy INTEGER,
       task_status_id TEXT FK task_status.id,
       created_at TEXT, updated_at TEXT)
- domain(id TEXT PK, parent_domain_id TEXT FK domain.id, name TEXT, description TEXT, icon TEXT, color INTEGER)
- session(id TEXT PK, started_at TEXT, ended_at TEXT, status INTEGER, aftermath_id TEXT FK aftermath.id)
  status codes: 0=Planned, 1=Started, 2=Finished, 3=NoLongerNeeded
- session_edge(id TEXT PK, session_id TEXT FK session.id, task_id TEXT FK task.id)
- aftermath(id TEXT PK, score INTEGER, description TEXT, icon TEXT, color INTEGER)
- task_status(id TEXT PK, name TEXT, is_initial INTEGER, is_terminal INTEGER, ...)
- task_dependency(id TEXT PK, from_task_id TEXT FK task.id, to_task_id TEXT FK task.id)

Design notes:
- Domains represent ability "battery packs" (coding, pixel art, writing, etc.).
- Tasks have metrics used for mood-based suggestions: high complexity when energetic, low when tired.
- Sessions link to one or more tasks via session_edge.
- Prefer actionable leaf tasks (parent_task_id may point to a parent; child tasks are usually better picks).
- Exclude tasks whose status is terminal when possible (join task_status and filter is_terminal = 0).
`.trim()
