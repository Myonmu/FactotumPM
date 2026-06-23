import { eq, isNull, or, type SQL } from 'drizzle-orm'
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core'

/** When a project is selected: match that project or global (null) rows. */
export function projectScopeCondition(
    column: SQLiteColumn,
    projectId: string | null,
): SQL | undefined {
    if (projectId == null) return undefined
    return or(eq(column, projectId), isNull(column))
}

export function matchesProjectScope(
    entityProjectId: string | null | undefined,
    currentProjectId: string | null,
): boolean {
    if (currentProjectId == null) return true
    return entityProjectId == null || entityProjectId === currentProjectId
}
