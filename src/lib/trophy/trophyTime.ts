import { invoke } from '@tauri-apps/api/core'

import { parseSqlTimestamp } from '$lib/calendar/dates'
import { getDb } from '$lib/db'
import { session, sessionEdge } from '$lib/db/schema'
import { SessionStatusCode } from '$lib/db/sessionStatus'

/**
 * Pre-aggregated session timing, shaped for fast per-trophy roll-ups.
 *
 * `durations[i]` is the spent-time (ms) of the i-th session; `taskToSessions`
 * maps a task id to the session indices that include it. To accumulate the time
 * spent on a trophy we union the session indices across the trophy's subtree and
 * sum the distinct durations (so a session attached to several tasks of the same
 * trophy is only counted once).
 */
export type SessionTimeIndex = {
    durations: number[]
    taskToSessions: Map<string, number[]>
}

const EMPTY_INDEX: SessionTimeIndex = { durations: [], taskToSessions: new Map() }

type SqlProxyRow = {
    columns: string[]
    rows: (string | number | boolean | null)[]
}

type CacheEntry = {
    /** Cheap content signature of the session + session_edge tables. */
    signature: string
    index: SessionTimeIndex
}

let cache: CacheEntry | null = null
let inflight: Promise<SessionTimeIndex> | null = null

/**
 * Drop the cached index. MUST be called whenever sessions or session-task links
 * change so the next read recomputes from scratch. This is the authoritative
 * validity mechanism for in-app writes (PRAGMA data_version does not change for
 * writes made on the same connection, which is the only connection we use).
 */
export function invalidateTrophyTimeCache(): void {
    cache = null
}

/**
 * Cheap signature query. Catches added/removed sessions and links, status
 * changes, and start/end edits. Combined with explicit invalidation on link
 * reassignment, this keeps the cache rigorously valid; any read failure forces a
 * full recompute (the safe fallback).
 */
async function readSessionSignature(): Promise<string | null> {
    try {
        const result = await invoke<SqlProxyRow[]>('execute_single_sql', {
            query: {
                sql: `SELECT
                        (SELECT COUNT(*) FROM session) AS session_count,
                        (SELECT COUNT(*) FROM session_edge) AS edge_count,
                        (SELECT COALESCE(SUM(status), 0) FROM session) AS status_sum,
                        (SELECT COALESCE(SUM(julianday(ended_at) - julianday(started_at)), 0)
                            FROM session WHERE status IN (1, 2)) AS duration_sum`,
                params: [],
            },
        })

        const row = result?.[0]?.rows
        if (!row) return null
        return row.map((value) => String(value ?? '')).join('|')
    } catch {
        return null
    }
}

function sessionDurationMs(
    startedAt: string | null,
    endedAt: string | null,
    status: number | null,
): number {
    // Only sessions that actually took place contribute to "time spent".
    if (status !== SessionStatusCode.Started && status !== SessionStatusCode.Finished) {
        return 0
    }

    const start = parseSqlTimestamp(startedAt)
    const end = parseSqlTimestamp(endedAt)
    if (!start || !end) return 0

    const ms = end.getTime() - start.getTime()
    return ms > 0 ? ms : 0
}

async function computeSessionTimeIndex(): Promise<SessionTimeIndex> {
    const db = await getDb()
    if (!db) return EMPTY_INDEX

    const [sessionRows, edgeRows] = await Promise.all([
        db
            .select({
                id: session.id,
                started_at: session.started_at,
                ended_at: session.ended_at,
                status: session.status,
            })
            .from(session),
        db
            .select({
                session_id: sessionEdge.session_id,
                task_id: sessionEdge.task_id,
            })
            .from(sessionEdge),
    ])

    const indexBySession = new Map<string, number>()
    const durations: number[] = []

    for (const row of sessionRows) {
        const idx = durations.length
        durations.push(sessionDurationMs(row.started_at, row.ended_at, row.status))
        indexBySession.set(row.id, idx)
    }

    const taskToSessions = new Map<string, number[]>()
    for (const edge of edgeRows) {
        const idx = indexBySession.get(edge.session_id)
        if (idx == null) continue
        const list = taskToSessions.get(edge.task_id)
        if (list) list.push(idx)
        else taskToSessions.set(edge.task_id, [idx])
    }

    return { durations, taskToSessions }
}

/**
 * Load the session time index, served from cache when the cheap signature is
 * unchanged. Falls back to a full recompute whenever the cache is missing,
 * stale, or the signature cannot be read.
 */
export async function loadSessionTimeIndex(
    options: { force?: boolean } = {},
): Promise<SessionTimeIndex> {
    const signature = await readSessionSignature()

    if (!options.force && cache && signature != null && cache.signature === signature) {
        return cache.index
    }

    if (inflight) return inflight

    inflight = (async () => {
        try {
            // Capture the signature immediately before reading so a concurrent
            // write during the read invalidates this result on the next call.
            const beforeSignature = signature ?? (await readSessionSignature())
            const index = await computeSessionTimeIndex()
            const afterSignature = await readSessionSignature()

            // Only trust the cache when the data was stable across the read and
            // the signature is reliable; otherwise leave the cache cleared so the
            // next read recomputes (fallback path).
            if (afterSignature != null && afterSignature === beforeSignature) {
                cache = { signature: afterSignature, index }
            } else {
                cache = null
            }

            return index
        } catch {
            cache = null
            return EMPTY_INDEX
        } finally {
            inflight = null
        }
    })()

    return inflight
}

/** Format a millisecond duration as a compact "Xh Ym" / "Ym" string. */
export function formatDurationMs(ms: number): string {
    if (!Number.isFinite(ms) || ms <= 0) return '0m'

    const totalMinutes = Math.round(ms / 60_000)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60

    if (hours === 0) return `${minutes}m`
    if (minutes === 0) return `${hours}h`
    return `${hours}h ${minutes}m`
}
