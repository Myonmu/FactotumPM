import type { FactotumViewType } from './types'
import { readRecordString } from './views'

/** Primary key column for each entity table (always `id` in FactotumPM). */
export const ENTITY_PRIMARY_KEY = 'id'

const ENTITY_ID_ALIASES: Partial<Record<FactotumViewType, string[]>> = {
    task: ['id', 'task_id'],
    session: ['id', 'session_id'],
    domain: ['id'],
    aftermath: ['id', 'aftermath_id'],
    task_status: ['id', 'task_status_id', 'status_id'],
}

export function isEntityViewType(type: FactotumViewType): boolean {
    return type !== 'table'
}

function selectListFromSql(sql: string): string | null {
    const normalized = sql.trim().replace(/\s+/g, ' ')
    const match = normalized.match(/\bSELECT\s+([\s\S]+?)\s+FROM\b/i)
    return match?.[1] ?? null
}

export function selectIncludesPrimaryKey(sql: string): boolean {
    const selectList = selectListFromSql(sql)
    if (!selectList) return false

    const lower = selectList.toLowerCase()
    if (lower === '*' || lower.startsWith('distinct *')) {
        return true
    }

    return /\bid\b/i.test(selectList)
}

export function validateEntityViewSql(
    sql: string,
    viewType: FactotumViewType,
): { ok: true } | { ok: false; message: string } {
    if (!isEntityViewType(viewType)) {
        return { ok: true }
    }

    if (selectIncludesPrimaryKey(sql)) {
        return { ok: true }
    }

    return {
        ok: false,
        message: `View SQL for type "${viewType}" must SELECT the primary key column \`id\` (or use SELECT *). Example: SELECT id, title FROM ${viewType === 'task_status' ? 'task_status' : viewType} ...`,
    }
}

export function extractEntityIds(
    records: Record<string, unknown>[],
    viewType: FactotumViewType,
): string[] {
    if (records.length === 0) return []

    const aliases = ENTITY_ID_ALIASES[viewType] ?? [ENTITY_PRIMARY_KEY]
    const ids: string[] = []

    for (const record of records) {
        for (const alias of aliases) {
            const id = readRecordString(record, alias)
            if (id) {
                ids.push(id)
                break
            }
        }
    }

    return [...new Set(ids)]
}

export function validateEntityViewRecords(
    records: Record<string, unknown>[],
    viewType: FactotumViewType,
): { ok: true; ids: string[] } | { ok: false; message: string } {
    if (!isEntityViewType(viewType)) {
        return { ok: true, ids: [] }
    }

    const ids = extractEntityIds(records, viewType)
    if (ids.length === 0 && records.length > 0) {
        return {
            ok: false,
            message: `Query returned ${records.length} row(s) but none had an \`id\` column. SELECT id (or SELECT *) is required for ${viewType} views.`,
        }
    }

    return { ok: true, ids }
}

export function idsFromRecordsOrColumns(
    records: Record<string, unknown>[],
    columns: string[],
    viewType: FactotumViewType,
): string[] {
    const fromRecords = extractEntityIds(records, viewType)
    if (fromRecords.length > 0) return fromRecords

    if (!isEntityViewType(viewType)) return []

    const lowerColumns = columns.map((column) => column.toLowerCase())
    const aliases = ENTITY_ID_ALIASES[viewType] ?? [ENTITY_PRIMARY_KEY]
    const hasIdColumn = aliases.some((alias) => lowerColumns.includes(alias))
    if (!hasIdColumn) return []

    return fromRecords
}
