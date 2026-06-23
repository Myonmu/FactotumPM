import { invoke } from '@tauri-apps/api/core'
import { eq, inArray, isNull } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'

import { getDb } from '$lib/db'
import { readSqlBoolean } from '$lib/db/coerce'
import { APP_TABLE_ORDER, domain, task, taskDependency } from '$lib/db/schema'
import { getInitialTaskStatusId } from '$lib/db/taskStatusMachine'
import { readMetricCanEstimate } from '$lib/taskMetrics'
import type { ColumnEditorKind, ColumnMeta, ReferenceOption } from '$lib/tableRendering'
import { isGridColumn } from '$lib/tableRendering'
import { SESSION_STATUS_OPTIONS } from '$lib/db/sessionStatus'
import { getCurrentProjectId } from '$lib/projectState.svelte'
import { projectScopeCondition } from '$lib/db/projectScope'

type SqlRow = {
    columns: string[]
    rows: (string | number | boolean | null)[]
}

const TABLE_DEFAULTS: Partial<Record<string, Record<string, unknown>>> = {
    project: { name: 'New project' },
    task: { title: 'New task' },
    task_dependency: {},
    task_status: { name: 'New status', pos_x: 0, pos_y: 0 },
    task_status_edge: { action: '' },
    domain: { name: 'New domain' },
    aftermath: { description: 'New aftermath' },
    observation: { content: 'New observation', confidence: 0.5 },
    session_edge: {},
}

let cachedTables: string[] | null = null
let schemaReady = false

async function ensureSchema(): Promise<void> {
    if (schemaReady) return

    try {
        const isReady = await invoke<boolean>('is_db_ready')
        if (isReady) {
            await invoke('run_pending_migrations')
            cachedTables = null
        }
    } catch (err) {
        console.error('Failed to apply pending migrations:', err)
    }

    schemaReady = true
}

function isAppTableName(tableName: string): boolean {
    return (APP_TABLE_ORDER as readonly string[]).includes(tableName)
}

function rowsToRecords(sqlRows: SqlRow[]): Record<string, unknown>[] {
    return sqlRows.map((row) => {
        const record: Record<string, unknown> = {}
        row.columns.forEach((column, index) => {
            record[column] = row.rows[index] ?? null
        })
        return record
    })
}

function readPragmaFlag(value: unknown): number {
    if (typeof value === 'number') return value
    if (typeof value === 'boolean') return value ? 1 : 0
    if (typeof value === 'string') {
        const parsed = Number(value)
        return Number.isNaN(parsed) ? 0 : parsed
    }
    return 0
}

function getRecordField(record: Record<string, unknown>, field: string): unknown {
    if (field in record) return record[field]

    const match = Object.keys(record).find((key) => key.toLowerCase() === field.toLowerCase())
    return match ? record[match] : undefined
}

/** Normalize values for the Tauri SQL proxy so NULL is sent as JSON null, not the string "null". */
function toSqlParam(value: unknown): string | number | boolean | null {
    if (value === null || value === undefined) return null
    if (typeof value === 'string' && value === 'null') return null
    if (typeof value === 'number' || typeof value === 'boolean') return value
    if (typeof value === 'bigint') return Number(value)
    if (typeof value === 'string') return value
    return String(value)
}

async function executeQuery(sql: string, params: unknown[] = []): Promise<SqlRow[]> {
    return invoke<SqlRow[]>('execute_single_sql', {
        query: { sql, params: params.map(toSqlParam) },
    })
}

function isSafeIdentifier(identifier: string): boolean {
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)
}

function quoteIdentifier(identifier: string): string {
    if (!isSafeIdentifier(identifier)) {
        throw new Error(`Unsafe SQL identifier: ${identifier}`)
    }

    return `"${identifier}"`
}

async function assertKnownTable(tableName: string): Promise<void> {
    if (!isAppTableName(tableName)) {
        throw new Error(`Unknown table: ${tableName}`)
    }

    const tables = await listTables()
    if (!tables.includes(tableName)) {
        throw new Error(`Table not found in database: ${tableName}`)
    }
}

export async function listTables(force = false): Promise<string[]> {
    await ensureSchema()

    if (cachedTables && !force) {
        return cachedTables
    }

    const rows = await executeQuery(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
        ORDER BY name
    `)

    const existing = new Set(
        rowsToRecords(rows).map((row) => String(row.name)),
    )

    cachedTables = APP_TABLE_ORDER.filter((name) => existing.has(name))
    return cachedTables
}

type ForeignKeyMeta = {
    from: string
    table: string
    to: string
}

const REFERENCE_LABEL_COLUMNS: Record<string, string> = {
    domain: 'name',
    task: 'title',
    aftermath: 'description',
    session: 'id',
    task_status: 'name',
    project: 'name',
}

const SESSION_STATUS_ENUM_OPTIONS: ReferenceOption[] = SESSION_STATUS_OPTIONS.map((option) => ({
    id: String(option.id),
    title: option.title,
}))

async function getForeignKeys(tableName: string): Promise<ForeignKeyMeta[]> {
    const rows = await executeQuery(`PRAGMA foreign_key_list(${quoteIdentifier(tableName)})`)

    return rowsToRecords(rows).map((row) => ({
        from: String(getRecordField(row, 'from') ?? ''),
        table: String(getRecordField(row, 'table') ?? ''),
        to: String(getRecordField(row, 'to') ?? 'id'),
    }))
}

function inferReferenceTable(columnName: string, tableName?: string): string | null {
    if (tableName === 'session_edge') {
        if (columnName === 'session_id') return 'session'
        if (columnName === 'task_id') return 'task'
    }

    if (!columnName.endsWith('_id')) {
        return null
    }

    const base = columnName.slice(0, -3)
    if (isAppTableName(base)) {
        return base
    }

    if (base.endsWith('_task') && isAppTableName('task')) {
        return 'task'
    }

    if (base.endsWith('_domain') && isAppTableName('domain')) {
        return 'domain'
    }

    return null
}

function getReferenceLabelColumn(tableName: string): string {
    return REFERENCE_LABEL_COLUMNS[tableName] ?? 'name'
}

function detectEditorKind(
    column: ColumnMeta,
    foreignKey?: ForeignKeyMeta,
): ColumnEditorKind {
    if (foreignKey || column.name.endsWith('_id')) {
        return 'foreignKey'
    }

    if (column.name === 'color' && column.dataType.toUpperCase().includes('INT')) {
        return 'color'
    }

    if (column.name === 'icon' && column.dataType.toUpperCase() === 'TEXT') {
        return 'icon'
    }

    if (column.name.endsWith('_at') && column.dataType.toUpperCase() === 'TEXT') {
        return 'datetime'
    }

    if (
        column.name.endsWith('_can_estimate')
        && column.dataType.toUpperCase().includes('INT')
    ) {
        return 'number'
    }

    if (
        (column.name.startsWith('is_') || column.name === 'route_pos_manual')
        && column.dataType.toUpperCase().includes('INT')
    ) {
        return 'boolean'
    }

    if (column.dataType.toUpperCase().includes('INT') && !column.isPrimaryKey) {
        return 'number'
    }

    return 'text'
}

export async function loadReferenceOptions(
    refTable: string,
    labelColumn: string,
): Promise<ReferenceOption[]> {
    if (!isAppTableName(refTable)) {
        return []
    }

    const tables = await listTables()
    if (!tables.includes(refTable)) {
        return []
    }

    const rows = await executeQuery(
        `SELECT ${quoteIdentifier('id')}, ${quoteIdentifier(labelColumn)} AS label FROM ${quoteIdentifier(refTable)} ORDER BY label`,
    )

    return rowsToRecords(rows).map((row) => ({
        id: String(row.id ?? ''),
        title: String(row.label ?? row.id ?? ''),
    }))
}

async function enrichTableColumns(
    tableName: string,
    columns: ColumnMeta[],
): Promise<ColumnMeta[]> {
    const foreignKeys = await getForeignKeys(tableName)

    return Promise.all(
        columns.map(async (column) => {
            if (tableName === 'session' && column.name === 'status') {
                return {
                    ...column,
                    editorKind: 'enum' as const,
                    enumOptions: SESSION_STATUS_ENUM_OPTIONS,
                }
            }

            const foreignKey = foreignKeys.find((entry) => entry.from === column.name)
            const refTable = foreignKey?.table ?? inferReferenceTable(column.name, tableName)
            const editorKind = detectEditorKind(column, foreignKey)

            if (editorKind !== 'foreignKey' || !refTable) {
                return {
                    ...column,
                    editorKind,
                }
            }

            const refLabelColumn = getReferenceLabelColumn(refTable)
            const referenceOptions = await loadReferenceOptions(refTable, refLabelColumn)

            return {
                ...column,
                editorKind,
                isForeignKey: true,
                refTable,
                refLabelColumn,
                referenceOptions,
            }
        }),
    )
}

export async function getTableColumns(tableName: string): Promise<ColumnMeta[]> {
    await assertKnownTable(tableName)

    const rows = await executeQuery(`PRAGMA table_info(${quoteIdentifier(tableName)})`)

    const records = rowsToRecords(rows)
    const hasDetectedPk = records.some(
        (row) => readPragmaFlag(getRecordField(row, 'pk')) > 0,
    )

    const columns = records.map((row) => {
        const name = String(getRecordField(row, 'name') ?? '')
        const pkValue = readPragmaFlag(getRecordField(row, 'pk'))
        const isPrimaryKey = pkValue > 0 || (!hasDetectedPk && name === 'id')
        const notNull =
            readPragmaFlag(getRecordField(row, 'notnull')) > 0 || isPrimaryKey

        return {
            name,
            dataType: String(getRecordField(row, 'type') || 'TEXT'),
            editable: !isPrimaryKey,
            notNull,
            defaultValue:
                getRecordField(row, 'dflt_value') == null
                    ? null
                    : String(getRecordField(row, 'dflt_value')),
            isPrimaryKey,
        }
    })

    return enrichTableColumns(tableName, columns)
}

export async function getPrimaryKeyColumn(tableName: string): Promise<string> {
    if (!isAppTableName(tableName)) {
        throw new Error(`Unknown table: ${tableName}`)
    }

    const columns = await getTableColumns(tableName)
    const primaryKey = columns.find((column) => column.isPrimaryKey)
    if (primaryKey) {
        return primaryKey.name
    }

    const idColumn = columns.find((column) => column.name === 'id')
    if (idColumn) {
        return idColumn.name
    }

    if (columns.length > 0) {
        return columns[0].name
    }

    throw new Error(`No primary key found for table ${tableName}`)
}

export async function fetchTableRows(
    tableName: string,
    projectId?: string | null,
): Promise<{
    columns: ColumnMeta[]
    rows: Record<string, unknown>[]
}> {
    await assertKnownTable(tableName)

    const columns = await getTableColumns(tableName)
    const gridColumns = columns.filter(isGridColumn)
    const selectColumns =
        gridColumns.length > 0 ? gridColumns : columns.filter((column) => column.isPrimaryKey)

    const selectList = selectColumns.map((column) => quoteIdentifier(column.name)).join(', ')

    const projectFilterableTables = ['task', 'session']
    const hasProjectCol = columns.some((c) => c.name === 'project_id')
    let sql: string
    let params: unknown[] = []

    if (projectId != null && projectFilterableTables.includes(tableName) && hasProjectCol) {
        sql = selectList.length > 0
            ? `SELECT ${selectList} FROM ${quoteIdentifier(tableName)} WHERE project_id = ?`
            : `SELECT ${quoteIdentifier(await getPrimaryKeyColumn(tableName))} FROM ${quoteIdentifier(tableName)} WHERE project_id = ?`
        params = [projectId]
    } else {
        sql = selectList.length > 0
            ? `SELECT ${selectList} FROM ${quoteIdentifier(tableName)}`
            : `SELECT ${quoteIdentifier(await getPrimaryKeyColumn(tableName))} FROM ${quoteIdentifier(tableName)}`
    }

    const sqlRows = await executeQuery(sql, params)

    return {
        columns,
        rows: rowsToRecords(sqlRows),
    }
}

export async function updateTableCell(
    tableName: string,
    rowId: string | number,
    columnName: string,
    value: unknown,
): Promise<void> {
    await assertKnownTable(tableName)

    const columns = await getTableColumns(tableName)
    const column = columns.find((entry) => entry.name === columnName)

    if (!column) {
        throw new Error(`Unknown column: ${columnName}`)
    }

    if (!column.editable) {
        throw new Error(`Column is not editable: ${columnName}`)
    }

    const primaryKey = await getPrimaryKeyColumn(tableName)

    await executeQuery(
        `UPDATE ${quoteIdentifier(tableName)} SET ${quoteIdentifier(columnName)} = ? WHERE ${quoteIdentifier(primaryKey)} = ?`,
        [value === '' ? null : value ?? null, rowId],
    )
}

function parseDefaultValue(defaultValue: string, dataType: string): unknown {
    const trimmed = defaultValue.replace(/^'(.*)'$/, '$1')
    if (dataType.toUpperCase().includes('INT')) {
        const parsed = Number(trimmed)
        return Number.isNaN(parsed) ? 0 : parsed
    }
    return trimmed
}

function buildDefaultRow(tableName: string, columns: ColumnMeta[]): Record<string, unknown> {
    const placeholders = TABLE_DEFAULTS[tableName] ?? {}
    const row: Record<string, unknown> = {}

    for (const column of columns) {
        if (column.name in placeholders) {
            row[column.name] = placeholders[column.name]
            continue
        }

        if (column.isPrimaryKey) {
            if (column.dataType.toUpperCase().includes('INT')) {
                continue
            }
            row[column.name] = uuid()
            continue
        }

        if (column.defaultValue?.includes('CURRENT_TIMESTAMP')) {
            continue
        }

        if (column.defaultValue != null) {
            row[column.name] = parseDefaultValue(column.defaultValue, column.dataType)
            continue
        }

        if (column.notNull) {
            row[column.name] = column.dataType.toUpperCase().includes('INT') ? 0 : ''
            continue
        }
    }

    const primaryKey = columns.find((column) => column.isPrimaryKey)
        ?? columns.find((column) => column.name === 'id')

    if (
        primaryKey
        && !(primaryKey.name in row)
        && !primaryKey.dataType.toUpperCase().includes('INT')
    ) {
        row[primaryKey.name] = uuid()
    }

    return row
}

async function fetchRowById(
    tableName: string,
    rowId: string,
): Promise<Record<string, unknown>> {
    const columns = await getTableColumns(tableName)
    const primaryKey = await getPrimaryKeyColumn(tableName)
    const gridColumns = columns.filter(isGridColumn)
    const selectColumns =
        gridColumns.length > 0
            ? gridColumns
            : columns.filter((column) => column.isPrimaryKey)
    const selectList = selectColumns.map((column) => quoteIdentifier(column.name)).join(', ')

    const fetched = await executeQuery(
        `SELECT ${selectList} FROM ${quoteIdentifier(tableName)} WHERE ${quoteIdentifier(primaryKey)} = ?`,
        [rowId],
    )
    const inserted = rowsToRecords(fetched)[0]
    if (!inserted) {
        throw new Error(`Failed to load inserted row in ${tableName}`)
    }

    return inserted
}

export async function insertTableRow(tableName: string): Promise<Record<string, unknown>> {
    await assertKnownTable(tableName)
    await ensureSchema()

    const columns = await getTableColumns(tableName)
    const row = buildDefaultRow(tableName, columns)

    if (tableName === 'task') {
        if (row.task_status_id == null) {
            const initialStatusId = await getInitialTaskStatusId()
            if (initialStatusId) {
                row.task_status_id = initialStatusId
            }
        }
        const currentProjectId = getCurrentProjectId()
        if (currentProjectId != null) {
            row.project_id = currentProjectId
        }
    }

    if (tableName === 'session') {
        const currentProjectId = getCurrentProjectId()
        if (currentProjectId != null) {
            row.project_id = currentProjectId
        }
    }

    const insertColumns = Object.keys(row)

    if (insertColumns.length === 0) {
        throw new Error(`Cannot create a row in ${tableName}`)
    }

    const placeholders = insertColumns.map(() => '?').join(', ')
    const sql = `INSERT INTO ${quoteIdentifier(tableName)} (${insertColumns.map(quoteIdentifier).join(', ')}) VALUES (${placeholders})`

    await executeQuery(
        sql,
        insertColumns.map((column) => row[column]),
    )

    const primaryKey = await getPrimaryKeyColumn(tableName)
    const rowId = String(row[primaryKey] ?? row.id ?? '')
    if (!rowId) {
        throw new Error(`Failed to determine inserted row id in ${tableName}`)
    }

    return fetchRowById(tableName, rowId)
}

export async function deleteTableRow(
    tableName: string,
    rowId: string | number,
): Promise<void> {
    await assertKnownTable(tableName)

    const primaryKey = await getPrimaryKeyColumn(tableName)

    await executeQuery(
        `DELETE FROM ${quoteIdentifier(tableName)} WHERE ${quoteIdentifier(primaryKey)} = ?`,
        [rowId],
    )
}

export type DomainOption = {
    id: string
    title: string
    color?: number | null
    parent_domain_id?: string | null
    icon?: string | null
}

export type TaskRecord = {
    id: string
    title: string
    description: string | null
    detail: string | null
    uncertainty: number | null
    uncertainty_can_estimate: number | null
    complexity: number | null
    complexity_can_estimate: number | null
    effort: number | null
    effort_can_estimate: number | null
    domain_id: string | null
    /** Explicit task color override. Null means inherit from domain at display time. */
    color: number | null
    parent_task_id: string | null
    is_trophy: boolean
    task_status_id: string | null
    project_id: string | null
    route_pos_x: number | null
    route_pos_y: number | null
    route_pos_manual: boolean
    created_at?: string | null
    updated_at?: string | null
}

export async function loadDomainOptions(projectId?: string | null): Promise<DomainOption[]> {
    const db = await getDb()
    if (!db) return []

    const baseQuery = db
        .select({
            id: domain.id,
            name: domain.name,
            color: domain.color,
            parent_domain_id: domain.parent_domain_id,
            icon: domain.icon,
        })
        .from(domain)

    // In project mode: this project or global (no project) items
    const scope = projectScopeCondition(domain.project_id, projectId ?? null)
    const rows = scope ? await baseQuery.where(scope) : await baseQuery

    return rows.map((row) => ({
        id: row.id,
        title: row.name,
        color: row.color,
        parent_domain_id: row.parent_domain_id ?? null,
        icon: row.icon,
    }))
}

export type TaskRef = {
    id: string
    title: string
    parent_task_id: string | null
    domain_id: string | null
    color: number | null
    is_trophy: boolean
    uncertainty: number | null
    uncertainty_can_estimate: number | null
    complexity: number | null
    complexity_can_estimate: number | null
    effort: number | null
    effort_can_estimate: number | null
}

/** @deprecated Use TaskRef */
export type TaskOption = TaskRef

export async function loadTaskOptions(projectId?: string | null): Promise<TaskRef[]> {
    const db = await getDb()
    if (!db) return []

    const baseQuery = db
        .select({
            id: task.id,
            title: task.title,
            parent_task_id: task.parent_task_id,
            domain_id: task.domain_id,
            color: task.color,
            is_trophy: task.is_trophy,
            uncertainty: task.uncertainty,
            uncertainty_can_estimate: task.uncertainty_can_estimate,
            complexity: task.complexity,
            complexity_can_estimate: task.complexity_can_estimate,
            effort: task.effort,
            effort_can_estimate: task.effort_can_estimate,
        })
        .from(task)

    const scope = projectScopeCondition(task.project_id, projectId ?? null)
    const rows = scope ? await baseQuery.where(scope) : await baseQuery

    return rows.map((row) => ({
        id: row.id,
        title: row.title,
        parent_task_id: row.parent_task_id ?? null,
        domain_id: row.domain_id ?? null,
        color: row.color ?? null,
        is_trophy: row.is_trophy ?? false,
        uncertainty: row.uncertainty ?? null,
        uncertainty_can_estimate: row.uncertainty_can_estimate ?? null,
        complexity: row.complexity ?? null,
        complexity_can_estimate: row.complexity_can_estimate ?? null,
        effort: row.effort ?? null,
        effort_can_estimate: row.effort_can_estimate ?? null,
    }))
}

export type TaskHierarchyItem = {
    id: string
    title: string
    parent_task_id: string | null
}

export type TaskChildListItem = {
    task: TaskHierarchyItem
    depth: number
}

export async function loadTaskHierarchy(): Promise<TaskHierarchyItem[]> {
    const db = await getDb()
    if (!db) return []

    const rows = await db
        .select({
            id: task.id,
            title: task.title,
            parent_task_id: task.parent_task_id,
        })
        .from(task)

    return rows.map((row) => ({
        id: row.id,
        title: row.title,
        parent_task_id: row.parent_task_id ?? null,
    }))
}

export function collectDescendantIds(
    parentTaskId: string,
    links: TaskHierarchyItem[],
): Set<string> {
    const childrenByParent = new Map<string, TaskHierarchyItem[]>()

    for (const link of links) {
        if (link.parent_task_id == null) continue
        const siblings = childrenByParent.get(link.parent_task_id) ?? []
        siblings.push(link)
        childrenByParent.set(link.parent_task_id, siblings)
    }

    const descendants = new Set<string>()
    const queue = [...(childrenByParent.get(parentTaskId) ?? [])]

    while (queue.length > 0) {
        const child = queue.shift()
        if (!child || descendants.has(child.id)) continue

        descendants.add(child.id)
        queue.push(...(childrenByParent.get(child.id) ?? []))
    }

    return descendants
}

export function collectAncestorIds(
    taskId: string,
    links: TaskHierarchyItem[],
): Set<string> {
    const tasksById = new Map(links.map((item) => [item.id, item]))
    const ancestors = new Set<string>()
    let current = tasksById.get(taskId)

    while (current?.parent_task_id) {
        ancestors.add(current.parent_task_id)
        current = tasksById.get(current.parent_task_id)
    }

    return ancestors
}

export type TaskDependencyEdge = {
    id: string
    from_task_id: string
    to_task_id: string
}

export function getExplicitTaskDependencies(
    taskId: string,
    edges: TaskDependencyEdge[],
): TaskDependencyEdge[] {
    return edges.filter(
        (edge) => edge.from_task_id === taskId || edge.to_task_id === taskId,
    )
}

export function getImplicitTaskDependencies(
    taskId: string,
    hierarchy: TaskHierarchyItem[],
    edges: TaskDependencyEdge[],
): TaskDependencyEdge[] {
    const ancestors = collectAncestorIds(taskId, hierarchy)

    return edges.filter((edge) => {
        if (edge.from_task_id === taskId || edge.to_task_id === taskId) return true
        if (ancestors.size === 0) return false
        return ancestors.has(edge.from_task_id) || ancestors.has(edge.to_task_id)
    })
}

export async function loadTaskDependencyEdges(): Promise<TaskDependencyEdge[]> {
    const db = await getDb()
    if (!db) return []

    const rows = await db
        .select({
            id: taskDependency.id,
            from_task_id: taskDependency.from_task_id,
            to_task_id: taskDependency.to_task_id,
        })
        .from(taskDependency)

    return rows.map((row) => ({
        id: row.id,
        from_task_id: row.from_task_id,
        to_task_id: row.to_task_id,
    }))
}

export async function addTaskDependency(
    fromTaskId: string,
    toTaskId: string,
): Promise<void> {
    const db = await getDb()
    if (!db) {
        throw new Error('Database not initialized')
    }

    if (fromTaskId === toTaskId) {
        throw new Error('A task cannot depend on itself')
    }

    await db.insert(taskDependency).values({
        id: uuid(),
        from_task_id: fromTaskId,
        to_task_id: toTaskId,
    })
}

export async function removeTaskDependency(dependencyId: string): Promise<void> {
    const db = await getDb()
    if (!db) {
        throw new Error('Database not initialized')
    }

    await db.delete(taskDependency).where(eq(taskDependency.id, dependencyId))
}

export type TaskChildTreeNode = {
    task: TaskHierarchyItem
    children: TaskChildTreeNode[]
}

export function buildTaskChildTree(
    parentTaskId: string,
    links: TaskHierarchyItem[],
): TaskChildTreeNode[] {
    const childrenByParent = new Map<string, TaskHierarchyItem[]>()

    for (const link of links) {
        if (link.parent_task_id == null) continue
        const siblings = childrenByParent.get(link.parent_task_id) ?? []
        siblings.push(link)
        childrenByParent.set(link.parent_task_id, siblings)
    }

    const sortByTitle = (a: TaskHierarchyItem, b: TaskHierarchyItem) =>
        a.title.localeCompare(b.title)

    function buildNodes(parentId: string): TaskChildTreeNode[] {
        return (childrenByParent.get(parentId) ?? [])
            .slice()
            .sort(sortByTitle)
            .map((item) => ({
                task: item,
                children: buildNodes(item.id),
            }))
    }

    return buildNodes(parentTaskId)
}

export function collectRecursiveChildTasks(
    parentTaskId: string,
    links: TaskHierarchyItem[],
): TaskChildListItem[] {
    const childrenByParent = new Map<string, TaskHierarchyItem[]>()

    for (const link of links) {
        if (link.parent_task_id == null) continue
        const siblings = childrenByParent.get(link.parent_task_id) ?? []
        siblings.push(link)
        childrenByParent.set(link.parent_task_id, siblings)
    }

    const sortByTitle = (a: TaskHierarchyItem, b: TaskHierarchyItem) =>
        a.title.localeCompare(b.title)

    const result: TaskChildListItem[] = []
    const queue: TaskChildListItem[] = (childrenByParent.get(parentTaskId) ?? [])
        .slice()
        .sort(sortByTitle)
        .map((child) => ({ task: child, depth: 1 }))

    while (queue.length > 0) {
        const current = queue.shift()
        if (!current) continue

        result.push(current)

        const grandchildren = (childrenByParent.get(current.task.id) ?? [])
            .slice()
            .sort(sortByTitle)
            .map((child) => ({ task: child, depth: current.depth + 1 }))

        queue.unshift(...grandchildren)
    }

    return result
}

export async function loadDirectChildTasks(parentTaskId: string): Promise<TaskHierarchyItem[]> {
    const db = await getDb()
    if (!db) return []

    const rows = await db
        .select({
            id: task.id,
            title: task.title,
            parent_task_id: task.parent_task_id,
        })
        .from(task)
        .where(eq(task.parent_task_id, parentTaskId))

    return rows
        .map((row) => ({
            id: row.id,
            title: row.title,
            parent_task_id: row.parent_task_id ?? null,
        }))
        .sort((a, b) => a.title.localeCompare(b.title))
}

export async function assignTaskParent(
    childTaskId: string,
    parentTaskId: string | null,
): Promise<void> {
    const db = await getDb()
    if (!db) {
        throw new Error('Database not initialized')
    }

    await db
        .update(task)
        .set({ parent_task_id: parentTaskId })
        .where(eq(task.id, childTaskId))
}

export async function loadTaskRecord(taskId: string): Promise<TaskRecord | null> {
    const db = await getDb()
    if (!db) return null

    const rows = await db.select().from(task).where(eq(task.id, taskId)).limit(1)
    const row = rows[0]
    if (!row) return null

    return recordToTask(row as unknown as Record<string, unknown>)
}

export async function taskHasChildren(taskId: string): Promise<boolean> {
    const db = await getDb()
    if (!db) return false

    const rows = await db
        .select({ id: task.id })
        .from(task)
        .where(eq(task.parent_task_id, taskId))
        .limit(1)

    return rows.length > 0
}

/** Task ids that have at least one child task (non-actionable for sessions). */
export async function loadTaskIdsWithChildren(taskIds: string[]): Promise<Set<string>> {
    const parents = await loadAllParentTaskIds()
    if (taskIds.length === 0) return new Set()

    const wanted = new Set(taskIds)
    return new Set([...parents].filter((id) => wanted.has(id)))
}

export async function isTaskActionable(taskId: string): Promise<boolean> {
    return !(await taskHasChildren(taskId))
}

async function loadAllParentTaskIds(): Promise<Set<string>> {
    const db = await getDb()
    if (!db) return new Set()

    const rows = await db.select({ parent_task_id: task.parent_task_id }).from(task)

    return new Set(
        rows
            .map((row) => row.parent_task_id)
            .filter((id): id is string => typeof id === 'string' && id.length > 0),
    )
}

export async function moveTaskToStatus(taskId: string, statusId: string): Promise<void> {
    const db = await getDb()
    if (!db) {
        throw new Error('Database not initialized')
    }

    await db
        .update(task)
        .set({ task_status_id: statusId })
        .where(eq(task.id, taskId))
}

export async function updateTaskRoutePosition(
    taskId: string,
    route_pos_x: number,
    route_pos_y: number,
): Promise<void> {
    const db = await getDb()
    if (!db) {
        throw new Error('Database not initialized')
    }

    await db
        .update(task)
        .set({
            route_pos_x,
            route_pos_y,
            route_pos_manual: true,
        })
        .where(eq(task.id, taskId))
}

export async function clearTaskRoutePositions(taskIds: string[]): Promise<void> {
    const db = await getDb()
    if (!db) {
        throw new Error('Database not initialized')
    }

    if (taskIds.length === 0) return

    await db
        .update(task)
        .set({
            route_pos_x: null,
            route_pos_y: null,
            route_pos_manual: false,
        })
        .where(inArray(task.id, taskIds))
}

export async function saveTaskRecord(updatedTask: TaskRecord): Promise<void> {
    const db = await getDb()
    if (!db) {
        throw new Error('Database not initialized')
    }

    await db
        .update(task)
        .set({
            title: updatedTask.title,
            description: updatedTask.description,
            detail: updatedTask.detail,
            uncertainty: updatedTask.uncertainty,
            uncertainty_can_estimate: updatedTask.uncertainty_can_estimate,
            complexity: updatedTask.complexity,
            complexity_can_estimate: updatedTask.complexity_can_estimate,
            effort: updatedTask.effort,
            effort_can_estimate: updatedTask.effort_can_estimate,
            domain_id: updatedTask.domain_id,
            color: updatedTask.color,
            parent_task_id: updatedTask.parent_task_id,
            is_trophy: updatedTask.is_trophy,
            task_status_id: updatedTask.task_status_id,
            project_id: updatedTask.project_id,
        })
        .where(eq(task.id, updatedTask.id))
}

export function recordToTask(record: Record<string, unknown>): TaskRecord {
    return {
        id: String(record.id ?? ''),
        title: String(record.title ?? ''),
        description: record.description == null ? null : String(record.description),
        detail: record.detail == null ? null : String(record.detail),
        uncertainty: record.uncertainty == null ? null : Number(record.uncertainty),
        uncertainty_can_estimate: readMetricCanEstimate(record.uncertainty_can_estimate),
        complexity: record.complexity == null ? null : Number(record.complexity),
        complexity_can_estimate: readMetricCanEstimate(record.complexity_can_estimate),
        effort: record.effort == null ? null : Number(record.effort),
        effort_can_estimate: readMetricCanEstimate(record.effort_can_estimate),
        domain_id: record.domain_id == null ? null : String(record.domain_id),
        color: record.color == null ? null : Number(record.color),
        parent_task_id: record.parent_task_id == null ? null : String(record.parent_task_id),
        is_trophy: readSqlBoolean(record.is_trophy),
        task_status_id: record.task_status_id == null ? null : String(record.task_status_id),
        project_id: record.project_id == null ? null : String(record.project_id),
        route_pos_x: record.route_pos_x == null ? null : Number(record.route_pos_x),
        route_pos_y: record.route_pos_y == null ? null : Number(record.route_pos_y),
        route_pos_manual: readSqlBoolean(record.route_pos_manual),
        created_at: record.created_at == null ? null : String(record.created_at),
        updated_at: record.updated_at == null ? null : String(record.updated_at),
    }
}
