import { desc, eq } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'

import { getDb } from '$lib/db'
import { observation } from '$lib/db/schema'

export type ObservationRecord = {
    id: string
    content: string
    confidence: number
    created_at: string | null
    updated_at: string | null
}

export type ObservationInput = {
    content: string
    confidence: number
}

export type ObservationUpdateInput = {
    id: string
    content?: string
    confidence: number
}

function mapObservationRow(row: {
    id: string
    content: string
    confidence: number
    created_at: string | null
    updated_at: string | null
}): ObservationRecord {
    return {
        id: row.id,
        content: row.content,
        confidence: row.confidence,
        created_at: row.created_at ?? null,
        updated_at: row.updated_at ?? null,
    }
}

export function clampConfidence(value: number): number {
    if (!Number.isFinite(value)) return 0
    return Math.min(1, Math.max(0, value))
}

export async function loadObservations(
    limit = 100,
    orderBy: 'confidence' | 'updated_at' = 'updated_at',
): Promise<ObservationRecord[]> {
    const db = await getDb()
    if (!db) return []

    const rows = await db
        .select()
        .from(observation)
        .orderBy(
            orderBy === 'confidence'
                ? desc(observation.confidence)
                : desc(observation.updated_at),
            desc(observation.updated_at),
        )
        .limit(limit)

    return rows.map(mapObservationRow)
}

export async function loadObservationById(observationId: string): Promise<ObservationRecord | null> {
    const db = await getDb()
    if (!db) return null

    const rows = await db.select().from(observation).where(eq(observation.id, observationId))
    const row = rows[0]
    return row ? mapObservationRow(row) : null
}

export async function createObservation(input: ObservationInput): Promise<ObservationRecord> {
    const db = await getDb()
    if (!db) {
        throw new Error('Database not initialized')
    }

    const id = uuid()
    const content = input.content.trim()
    if (!content) {
        throw new Error('Observation content is required')
    }

    await db.insert(observation).values({
        id,
        content,
        confidence: clampConfidence(input.confidence),
    })

    const created = await loadObservationById(id)
    if (!created) {
        throw new Error('Failed to load created observation')
    }

    return created
}

export async function updateObservation(input: ObservationUpdateInput): Promise<ObservationRecord> {
    const db = await getDb()
    if (!db) {
        throw new Error('Database not initialized')
    }

    const existing = await loadObservationById(input.id)
    if (!existing) {
        throw new Error(`Observation not found: ${input.id}`)
    }

    const nextContent = input.content?.trim() ?? existing.content
    if (!nextContent) {
        throw new Error('Observation content cannot be empty')
    }

    const now = new Date().toISOString()

    await db
        .update(observation)
        .set({
            content: nextContent,
            confidence: clampConfidence(input.confidence),
            updated_at: now,
        })
        .where(eq(observation.id, input.id))

    const updated = await loadObservationById(input.id)
    if (!updated) {
        throw new Error('Failed to load updated observation')
    }

    return updated
}

export function formatObservationsForPrompt(records: ObservationRecord[]): string {
    if (records.length === 0) {
        return 'No saved observations yet.'
    }

    return records
        .map((entry) => {
            const confidence = Math.round(entry.confidence * 100)
            return `- [${entry.id}] (${confidence}% confidence) ${entry.content}`
        })
        .join('\n')
}
