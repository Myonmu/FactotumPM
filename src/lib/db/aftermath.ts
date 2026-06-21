import { eq } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'

import { getDb } from '$lib/db'
import { aftermath, session } from '$lib/db/schema'

export type AftermathInput = {
    score?: number | null
    description?: string | null
    icon?: string | null
    color?: number | null
}

export type AftermathRecord = {
    id: string
    score: number | null
    description: string | null
    icon: string | null
    color: number | null
}

export type AftermathOption = {
    id: string
    title: string
    score: number | null
    description: string | null
    icon: string | null
    color: number | null
}

function mapAftermathRow(row: {
    id: string
    score: number | null
    description: string | null
    icon: string | null
    color: number | null
}): AftermathRecord {
    return {
        id: row.id,
        score: row.score ?? null,
        description: row.description ?? null,
        icon: row.icon ?? null,
        color: row.color ?? null,
    }
}

export function formatAftermathLabel(record: Pick<AftermathRecord, 'description' | 'score'>): string {
    const description = record.description?.trim()
    if (description) return description

    if (record.score != null) {
        return `Score ${record.score}/5`
    }

    return 'Untitled aftermath'
}

export function toAftermathOption(record: AftermathRecord): AftermathOption {
    return {
        id: record.id,
        title: formatAftermathLabel(record),
        score: record.score,
        description: record.description,
        icon: record.icon,
        color: record.color,
    }
}

export async function loadAftermaths(): Promise<AftermathRecord[]> {
    const db = await getDb()
    if (!db) return []

    const rows = await db.select().from(aftermath)
    return rows.map(mapAftermathRow)
}

export async function loadAftermathOptions(): Promise<AftermathOption[]> {
    const records = await loadAftermaths()
    return records
        .map(toAftermathOption)
        .sort((left, right) => left.title.localeCompare(right.title))
}

export async function loadAftermathById(aftermathId: string): Promise<AftermathRecord | null> {
    const db = await getDb()
    if (!db) return null

    const rows = await db.select().from(aftermath).where(eq(aftermath.id, aftermathId))
    const row = rows[0]
    return row ? mapAftermathRow(row) : null
}

export async function createAftermath(input: AftermathInput): Promise<AftermathRecord> {
    const db = await getDb()
    if (!db) {
        throw new Error('Database not initialized')
    }

    const id = uuid()

    await db.insert(aftermath).values({
        id,
        score: input.score ?? null,
        description: input.description ?? null,
        icon: input.icon ?? null,
        color: input.color ?? null,
    })

    const created = await loadAftermathById(id)

    if (!created) {
        throw new Error('Failed to load created aftermath')
    }

    return created
}

export async function linkAftermathToSession(sessionId: string, aftermathId: string): Promise<void> {
    const db = await getDb()
    if (!db) {
        throw new Error('Database not initialized')
    }

    await db
        .update(session)
        .set({ aftermath_id: aftermathId })
        .where(eq(session.id, sessionId))
}
