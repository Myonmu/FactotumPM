import { getPrefString, savePrefString } from '$lib/prefStore'

const PREF_PREFIX = 'kanban.columnHeight.'

/** Default task list body height (matches previous max-h-80). */
export const DEFAULT_KANBAN_COLUMN_BODY_HEIGHT = 320

/** Minimum task list body height. */
export const MIN_KANBAN_COLUMN_BODY_HEIGHT = 96

function parseColumnHeight(raw: string | null): number | null {
    if (!raw) return null
    const parsed = Number.parseFloat(raw)
    if (!Number.isFinite(parsed)) return null
    return Math.max(MIN_KANBAN_COLUMN_BODY_HEIGHT, Math.round(parsed))
}

export async function loadColumnHeight(statusId: string): Promise<number> {
    const raw = await getPrefString(`${PREF_PREFIX}${statusId}`)
    return parseColumnHeight(raw) ?? DEFAULT_KANBAN_COLUMN_BODY_HEIGHT
}

export async function saveColumnHeight(statusId: string, height: number): Promise<void> {
    const clamped = Math.max(MIN_KANBAN_COLUMN_BODY_HEIGHT, Math.round(height))
    await savePrefString(`${PREF_PREFIX}${statusId}`, String(clamped))
}

export async function loadAllColumnHeights(statusIds: string[]): Promise<Record<string, number>> {
    const entries = await Promise.all(
        statusIds.map(async (statusId) => [statusId, await loadColumnHeight(statusId)] as const),
    )
    return Object.fromEntries(entries)
}
