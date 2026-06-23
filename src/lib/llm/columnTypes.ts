import type { JoinableTableName, QueryableTableName } from './types'

export type AgentColumnType =
    | 'uuid'
    | 'text'
    | 'integer'
    | 'real'
    | 'boolean'
    | 'datetime'
    | 'enum'

export type AgentColumnSpec = {
    name: string
    type: AgentColumnType
    nullable?: boolean
    notes?: string
}

export const AGENT_TABLE_COLUMNS: Record<QueryableTableName, AgentColumnSpec[]> = {
    task: [
        { name: 'id', type: 'uuid' },
        { name: 'title', type: 'text' },
        { name: 'description', type: 'text', nullable: true },
        { name: 'detail', type: 'text', nullable: true },
        {
            name: 'uncertainty',
            type: 'integer',
            nullable: true,
            notes: '1-10 scale; null when unknown',
        },
        {
            name: 'uncertainty_can_estimate',
            type: 'integer',
            nullable: true,
            notes: 'null=unset, 0=unknown, 1=has estimate',
        },
        {
            name: 'complexity',
            type: 'integer',
            nullable: true,
            notes: '1-10 scale; 0=very easy; null when unknown',
        },
        {
            name: 'complexity_can_estimate',
            type: 'integer',
            nullable: true,
            notes: 'null=unset, 0=unknown, 1=has estimate',
        },
        {
            name: 'effort',
            type: 'integer',
            nullable: true,
            notes: '1-10 scale; 0=minimal; null when unknown',
        },
        {
            name: 'effort_can_estimate',
            type: 'integer',
            nullable: true,
            notes: 'null=unset, 0=unknown, 1=has estimate',
        },
        { name: 'domain_id', type: 'uuid', nullable: true, notes: 'FK domain.id' },
        { name: 'color', type: 'integer', nullable: true, notes: 'ARGB int' },
        { name: 'parent_task_id', type: 'uuid', nullable: true, notes: 'FK task.id' },
        { name: 'is_trophy', type: 'boolean', notes: 'milestone marker' },
        { name: 'task_status_id', type: 'uuid', nullable: true, notes: 'FK task_status.id' },
        { name: 'project_id', type: 'uuid', nullable: true, notes: 'FK project.id' },
        { name: 'route_pos_x', type: 'real', nullable: true },
        { name: 'route_pos_y', type: 'real', nullable: true },
        { name: 'route_pos_manual', type: 'boolean', notes: 'manual route layout' },
        { name: 'created_at', type: 'datetime' },
        { name: 'updated_at', type: 'datetime' },
    ],
    domain: [
        { name: 'id', type: 'uuid' },
        { name: 'parent_domain_id', type: 'uuid', nullable: true, notes: 'FK domain.id' },
        { name: 'name', type: 'text' },
        { name: 'description', type: 'text', nullable: true },
        { name: 'icon', type: 'text', nullable: true },
        { name: 'color', type: 'integer', nullable: true, notes: 'ARGB int' },
        { name: 'project_id', type: 'uuid', nullable: true, notes: 'FK project.id' },
    ],
    session: [
        { name: 'id', type: 'uuid' },
        { name: 'started_at', type: 'datetime' },
        { name: 'ended_at', type: 'datetime' },
        {
            name: 'status',
            type: 'enum',
            notes: '0=Planned, 1=Started, 2=Finished, 3=NoLongerNeeded',
        },
        { name: 'aftermath_id', type: 'uuid', nullable: true, notes: 'FK aftermath.id' },
        { name: 'project_id', type: 'uuid', nullable: true, notes: 'FK project.id' },
    ],
    aftermath: [
        { name: 'id', type: 'uuid' },
        { name: 'score', type: 'integer', nullable: true, notes: '1-5 satisfaction' },
        { name: 'description', type: 'text', nullable: true },
        { name: 'icon', type: 'text', nullable: true },
        { name: 'color', type: 'integer', nullable: true, notes: 'ARGB int' },
        { name: 'project_id', type: 'uuid', nullable: true, notes: 'FK project.id' },
    ],
    task_status: [
        { name: 'id', type: 'uuid' },
        { name: 'name', type: 'text' },
        { name: 'description', type: 'text', nullable: true },
        { name: 'pos_x', type: 'real' },
        { name: 'pos_y', type: 'real' },
        { name: 'kanban_pos_x', type: 'real', nullable: true },
        { name: 'kanban_pos_y', type: 'real', nullable: true },
        { name: 'is_initial', type: 'boolean', notes: 'workflow entry status' },
        { name: 'is_terminal', type: 'boolean', notes: 'completed/done status' },
        { name: 'color', type: 'integer', nullable: true, notes: 'ARGB int' },
        { name: 'project_id', type: 'uuid', nullable: true, notes: 'FK project.id' },
    ],
    observation: [
        { name: 'id', type: 'uuid' },
        { name: 'content', type: 'text' },
        { name: 'confidence', type: 'real', notes: '0.0-1.0 predictive confidence' },
        { name: 'created_at', type: 'datetime' },
        { name: 'updated_at', type: 'datetime' },
    ],
}

export const AGENT_JOINABLE_TABLES: Record<
    JoinableTableName,
    { columns: AgentColumnSpec[]; purpose: string }
> = {
    session_edge: {
        purpose: 'Many-to-many link: which tasks were worked in a session',
        columns: [
            { name: 'id', type: 'uuid' },
            { name: 'session_id', type: 'uuid', notes: 'FK session.id' },
            { name: 'task_id', type: 'uuid', notes: 'FK task.id' },
        ],
    },
    task_dependency: {
        purpose:
            'Prerequisite edge: from_task_id must be done before to_task_id can proceed',
        columns: [
            { name: 'id', type: 'uuid' },
            { name: 'from_task_id', type: 'uuid', notes: 'FK task.id (blocker / prerequisite)' },
            { name: 'to_task_id', type: 'uuid', notes: 'FK task.id (dependent task)' },
        ],
    },
    task_status_edge: {
        purpose: 'Allowed workflow transition from one task_status to another',
        columns: [
            { name: 'id', type: 'uuid' },
            { name: 'from_status_id', type: 'uuid', notes: 'FK task_status.id' },
            { name: 'to_status_id', type: 'uuid', notes: 'FK task_status.id' },
            { name: 'action', type: 'text', nullable: true, notes: 'transition label' },
            { name: 'color', type: 'integer', nullable: true },
        ],
    },
}

function formatColumnSpec(column: AgentColumnSpec): string {
    const nullable = column.nullable ? ' nullable' : ''
    const notes = column.notes ? ` — ${column.notes}` : ''
    return `${column.name} ${column.type}${nullable}${notes}`
}

export function formatTableColumnsForAgent(table: QueryableTableName): string {
    return AGENT_TABLE_COLUMNS[table].map(formatColumnSpec).join('; ')
}

export { formatColumnSpec }

export function formatQueryableTablesForAgent(): string {
    return (Object.keys(AGENT_TABLE_COLUMNS) as QueryableTableName[])
        .map((table) => `- ${table}: ${formatTableColumnsForAgent(table)}`)
        .join('\n')
}

export function formatJoinableTablesForAgent(): string {
    return (Object.keys(AGENT_JOINABLE_TABLES) as JoinableTableName[])
        .map((table) => {
            const spec = AGENT_JOINABLE_TABLES[table]
            const columns = spec.columns.map(formatColumnSpec).join('; ')
            return `- ${table}: ${spec.purpose}\n  columns: ${columns}`
        })
        .join('\n')
}

export function formatSqlTablesForAgent(): string {
    return `Entity tables (primary rows; use as <factotum-view> types):
${formatQueryableTablesForAgent()}

Join tables (use in SQL JOINs / subqueries — not view types):
${formatJoinableTablesForAgent()}

SQL may JOIN entity and join tables freely. Example — tasks not blocked by an unfinished prerequisite:
SELECT t.id, t.title
FROM task t
WHERE NOT EXISTS (
  SELECT 1
  FROM task_dependency d
  JOIN task blocker ON blocker.id = d.from_task_id
  LEFT JOIN task_status ts ON ts.id = blocker.task_status_id
  WHERE d.to_task_id = t.id
    AND (blocker.task_status_id IS NULL OR ts.is_terminal = 0)
)
LIMIT 20`
}

export function formatAgentSchemaContext(): string {
    return `
SQLite schema for FactotumPM (personal stamina-oriented project management).

Type legend:
- uuid: TEXT primary key (UUID string)
- integer: INTEGER numeric value
- real: REAL floating point
- boolean: INTEGER 0/1 (use 0/1 in SQL comparisons: WHERE is_trophy = 1)
- datetime: TEXT ISO-8601 timestamp
- enum: INTEGER code (see column notes)
- text: TEXT string

Tables:
- task(${formatTableColumnsForAgent('task')})
- domain(${formatTableColumnsForAgent('domain')})
- session(${formatTableColumnsForAgent('session')})
- session_edge(id uuid, session_id uuid FK session.id, task_id uuid FK task.id)
- aftermath(${formatTableColumnsForAgent('aftermath')})
- task_status(${formatTableColumnsForAgent('task_status')})
- task_dependency(id uuid, from_task_id uuid FK task.id, to_task_id uuid FK task.id) — prerequisite edge
- task_status_edge(id uuid, from_status_id uuid, to_status_id uuid, action text, color integer)
- observation(${formatTableColumnsForAgent('observation')})

Join tables (SQL only):
${formatJoinableTablesForAgent()}

Design notes:
- Domains represent ability "battery packs" (coding, pixel art, writing, etc.).
- Domains may have parent domain. When user requests a parent domain, consider all its subdomains.
- Task metrics (uncertainty/complexity/effort) are INTEGER 1-10 when set; use *_can_estimate to interpret null metrics.
- Sessions link to tasks via session_edge (many-to-many).
- task_dependency: from_task_id is a prerequisite for to_task_id.
- SQL may JOIN any table above; <factotum-view type="..."> only supports entity tables.
- observation stores learned behavioral patterns for personalized suggestions.
- Prefer actionable leaf tasks; exclude terminal statuses (task_status.is_terminal = 1).
`.trim()
}
