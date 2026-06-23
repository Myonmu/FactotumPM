import type { ParsedObservation } from './types'
import {
    clampConfidence,
    createObservation,
    loadObservationById,
    updateObservation,
    type ObservationRecord,
} from '$lib/db/observations'

export type AppliedObservation = {
    action: 'create' | 'update'
    record: ObservationRecord
}

export type FailedObservation = {
    input: ParsedObservation
    error: string
}

export type ObservationApplyResult = {
    applied: AppliedObservation[]
    failed: FailedObservation[]
}

function normalizeConfidence(value: unknown): number | null {
    if (typeof value === 'number') return clampConfidence(value)
    if (typeof value === 'string') {
        const parsed = Number(value)
        if (!Number.isNaN(parsed)) return clampConfidence(parsed)
    }
    return null
}

export function validateParsedObservation(
    input: ParsedObservation,
): { ok: true } | { ok: false; error: string } {
    const confidence = normalizeConfidence(input.confidence)
    if (confidence == null) {
        return { ok: false, error: 'confidence must be a number between 0 and 1' }
    }

    if (input.action === 'create') {
        const content = input.content?.trim() ?? ''
        if (!content) {
            return { ok: false, error: 'create requires non-empty content' }
        }
        return { ok: true }
    }

    if (input.action === 'update') {
        const id = input.id?.trim() ?? ''
        if (!id) {
            return { ok: false, error: 'update requires id' }
        }
        if (input.content != null && !input.content.trim()) {
            return { ok: false, error: 'update content cannot be empty when provided' }
        }
        return { ok: true }
    }

    return { ok: false, error: `Unknown action: ${String(input.action)}` }
}

export async function applyObservationBlocks(
    blocks: ParsedObservation[],
): Promise<ObservationApplyResult> {
    const applied: AppliedObservation[] = []
    const failed: FailedObservation[] = []

    for (const input of blocks) {
        const validation = validateParsedObservation(input)
        if (!validation.ok) {
            failed.push({ input, error: validation.error })
            continue
        }

        const confidence = normalizeConfidence(input.confidence) ?? 0

        try {
            if (input.action === 'create') {
                const record = await createObservation({
                    content: input.content!.trim(),
                    confidence,
                })
                applied.push({ action: 'create', record })
                continue
            }

            const existing = await loadObservationById(input.id!.trim())
            if (!existing) {
                failed.push({ input, error: `Observation not found: ${input.id}` })
                continue
            }

            const record = await updateObservation({
                id: input.id!.trim(),
                content: input.content?.trim(),
                confidence,
            })
            applied.push({ action: 'update', record })
        } catch (err) {
            failed.push({
                input,
                error: err instanceof Error ? err.message : 'Failed to save observation',
            })
        }
    }

    return { applied, failed }
}
