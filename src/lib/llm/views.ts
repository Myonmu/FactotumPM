import { executeReadonlySql, sqlRowsToRecords } from './client'
import type { ParsedFactotumView, ResolvedFactotumView } from './types'
import { inferViewTypeFromSql } from './viewTypeInference'
import {
    validateEntityViewRecords,
    validateEntityViewSql,
} from './viewIdEnforcement'
import { looksLikeSelectSql } from './viewBodyParser'

function emptyResolved(
    base: { type: ParsedFactotumView['type']; title: string | null },
    overrides: Partial<ResolvedFactotumView>,
): ResolvedFactotumView {
    return {
        ...base,
        columns: [],
        records: [],
        entityIds: [],
        sql: null,
        warning: null,
        error: null,
        ...overrides,
    }
}

export async function resolveView(view: ParsedFactotumView): Promise<ResolvedFactotumView> {
    const base = {
        type: view.type,
        title: view.title,
    }

    if (view.parseError) {
        return emptyResolved(base, { error: view.parseError })
    }

    if (view.inlineRecords) {
        const effectiveType = view.type
        const recordCheck = validateEntityViewRecords(view.inlineRecords, effectiveType)
        return emptyResolved(base, {
            type: effectiveType,
            columns: view.inlineColumns ?? [],
            records: view.inlineRecords,
            entityIds: recordCheck.ok ? recordCheck.ids : [],
            warning: view.inlineWarning ?? null,
            error: recordCheck.ok ? null : recordCheck.message,
        })
    }

    const sql = view.sql?.trim() ?? ''
    if (!sql) {
        return emptyResolved(base, { error: 'View block is empty.' })
    }

    if (!looksLikeSelectSql(sql)) {
        return emptyResolved(base, { sql, error: 'View block must contain a SELECT query only.' })
    }

    const effectiveType = inferViewTypeFromSql(sql, view.type)
    const sqlCheck = validateEntityViewSql(sql, effectiveType)
    if (!sqlCheck.ok) {
        return emptyResolved(base, {
            type: effectiveType,
            sql,
            error: sqlCheck.message,
        })
    }

    try {
        const rows = await executeReadonlySql(sql, 50)
        const records = sqlRowsToRecords(rows)
        const columns = rows[0]?.columns ?? (records[0] ? Object.keys(records[0]) : [])
        const recordCheck = validateEntityViewRecords(records, effectiveType)

        if (!recordCheck.ok) {
            return emptyResolved(base, {
                type: effectiveType,
                columns,
                records,
                entityIds: [],
                sql,
                error: recordCheck.message,
            })
        }

        return {
            ...base,
            type: effectiveType,
            columns,
            records,
            entityIds: recordCheck.ids,
            sql,
            warning: null,
            error: null,
        }
    } catch (err) {
        return emptyResolved(base, {
            type: effectiveType,
            sql,
            error: err instanceof Error ? err.message : 'Failed to run view query',
        })
    }
}

export async function resolveViews(
    views: ParsedFactotumView[],
): Promise<ResolvedFactotumView[]> {
    return Promise.all(views.map(resolveView))
}

export function readRecordString(
    record: Record<string, unknown>,
    ...keys: string[]
): string | null {
    for (const key of keys) {
        const value = record[key]
        if (typeof value === 'string' && value.trim()) {
            return value.trim()
        }
    }

    const lowerKeys = keys.map((key) => key.toLowerCase())
    for (const [key, value] of Object.entries(record)) {
        if (lowerKeys.includes(key.toLowerCase()) && typeof value === 'string' && value.trim()) {
            return value.trim()
        }
    }

    return null
}

export function readRecordNumber(
    record: Record<string, unknown>,
    ...keys: string[]
): number | null {
    for (const key of keys) {
        const value = record[key]
        if (typeof value === 'number') return value
        if (typeof value === 'string') {
            const parsed = Number(value)
            if (!Number.isNaN(parsed)) return parsed
        }
    }

    return null
}
