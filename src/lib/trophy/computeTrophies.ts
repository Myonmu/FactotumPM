import type { TaskRecord } from '$lib/db/dataView'

import type { SessionTimeIndex } from './trophyTime'

/** The three task metrics that contribute to a trophy. */
export type MetricKey = 'uncertainty' | 'complexity' | 'effort'

/** Average value substituted for unknown metrics when computing trophy value/size. */
export const DEFAULT_METRIC = 5

/** Minimum ratio over the next metric to be considered "significant". */
const SIGNIFICANCE_RATIO = 1.2

/** Canonical metric ordering used to keep dual-type labels stable. */
const METRIC_ORDER: MetricKey[] = ['uncertainty', 'complexity', 'effort']

export const METRIC_TROPHY_META: Record<MetricKey, { name: string; color: string }> = {
    uncertainty: { name: 'Exploration', color: '#22c55e' },
    complexity: { name: 'Mastery', color: '#3b82f6' },
    effort: { name: 'Perseverance', color: '#06b6d4' },
}

export const PROGRESS_TROPHY_META = { name: 'Progress', color: '#eab308' }

export type TrophyType = {
    /** Significant metrics in canonical order. Empty means no significance ("Progress"). */
    significant: MetricKey[]
    /** Stable identifier for filtering/grouping, e.g. "mastery+perseverance" or "progress". */
    key: string
    /** Short label, e.g. "Mastery and Perseverance" or "Progress". */
    shortLabel: string
    /** Full label, e.g. "Trophy of Mastery and Perseverance". */
    label: string
    /** One color for single/no significance, two colors for a dual type (for split rendering). */
    colors: string[]
}

export type MetricTotals = Record<MetricKey, number>

export type TrophyView = {
    task: TaskRecord
    /** complexity * effort, aggregated from children. */
    value: number
    /** Lower size bound. */
    lower: number
    /** Upper size bound. */
    upper: number
    /** Optimistic size used for ordering/filtering/grouping (the upper bound). */
    sizeOptimistic: number
    /** Completion ratio in [0, 1]. */
    progression: number
    /** Whether the trophy task itself is in a terminal status. */
    achieved: boolean
    /** Accumulated time spent (ms) across the trophy's subtree, from sessions. */
    timeSpentMs: number
    type: TrophyType
    /** Leaf task ids that contribute value to this trophy. */
    contributingTaskIds: string[]
    /** Aggregated metric totals across contributing leaves (null counts as 0). */
    metricTotals: MetricTotals
}

type ValueBounds = { value: number; lower: number; upper: number }

type ComputeContext = {
    byId: Map<string, TaskRecord>
    childrenByParent: Map<string, TaskRecord[]>
    terminalStatusIds: Set<string>
    boundsMemo: Map<string, ValueBounds>
    leafMemo: Map<string, string[]>
    subtreeMemo: Map<string, string[]>
    sessionTime: SessionTimeIndex | null
}

function metricForSize(value: number | null, canEstimate: number | null): number {
    return canEstimate === 1 && value != null ? value : DEFAULT_METRIC
}

function metricForType(value: number | null, canEstimate: number | null): number {
    return canEstimate === 1 && value != null ? value : 0
}

function leafBounds(task: TaskRecord): ValueBounds {
    const complexity = metricForSize(task.complexity, task.complexity_can_estimate)
    const effort = metricForSize(task.effort, task.effort_can_estimate)
    const uncertainty = metricForSize(task.uncertainty, task.uncertainty_can_estimate)

    const value = complexity * effort
    const upper = value * (1 + (2 * uncertainty) / 10)
    const lower = value * (1 - (0.3 * uncertainty) / 10)

    return { value, lower, upper }
}

function computeBounds(taskId: string, ctx: ComputeContext): ValueBounds {
    const memoized = ctx.boundsMemo.get(taskId)
    if (memoized) return memoized

    // Guard against cyclic parent references.
    ctx.boundsMemo.set(taskId, { value: 0, lower: 0, upper: 0 })

    const task = ctx.byId.get(taskId)
    const children = ctx.childrenByParent.get(taskId) ?? []

    let result: ValueBounds
    if (!task) {
        result = { value: 0, lower: 0, upper: 0 }
    } else if (children.length === 0) {
        result = leafBounds(task)
    } else {
        result = children.reduce<ValueBounds>(
            (acc, child) => {
                const childBounds = computeBounds(child.id, ctx)
                return {
                    value: acc.value + childBounds.value,
                    lower: acc.lower + childBounds.lower,
                    upper: acc.upper + childBounds.upper,
                }
            },
            { value: 0, lower: 0, upper: 0 },
        )
    }

    ctx.boundsMemo.set(taskId, result)
    return result
}

function collectLeafDescendants(taskId: string, ctx: ComputeContext): string[] {
    const memoized = ctx.leafMemo.get(taskId)
    if (memoized) return memoized

    ctx.leafMemo.set(taskId, [])
    const children = ctx.childrenByParent.get(taskId) ?? []

    let leaves: string[]
    if (children.length === 0) {
        leaves = ctx.byId.has(taskId) ? [taskId] : []
    } else {
        const seen = new Set<string>()
        leaves = []
        for (const child of children) {
            for (const leafId of collectLeafDescendants(child.id, ctx)) {
                if (!seen.has(leafId)) {
                    seen.add(leafId)
                    leaves.push(leafId)
                }
            }
        }
    }

    ctx.leafMemo.set(taskId, leaves)
    return leaves
}

function collectSubtreeTaskIds(taskId: string, ctx: ComputeContext): string[] {
    const memoized = ctx.subtreeMemo.get(taskId)
    if (memoized) return memoized

    ctx.subtreeMemo.set(taskId, [])
    const result: string[] = ctx.byId.has(taskId) ? [taskId] : []
    const seen = new Set<string>(result)

    for (const child of ctx.childrenByParent.get(taskId) ?? []) {
        for (const descendantId of collectSubtreeTaskIds(child.id, ctx)) {
            if (!seen.has(descendantId)) {
                seen.add(descendantId)
                result.push(descendantId)
            }
        }
    }

    ctx.subtreeMemo.set(taskId, result)
    return result
}

function timeSpentForSubtree(subtreeIds: string[], ctx: ComputeContext): number {
    if (!ctx.sessionTime) return 0

    const sessionIndices = new Set<number>()
    for (const taskId of subtreeIds) {
        const indices = ctx.sessionTime.taskToSessions.get(taskId)
        if (!indices) continue
        for (const index of indices) sessionIndices.add(index)
    }

    let ms = 0
    for (const index of sessionIndices) {
        ms += ctx.sessionTime.durations[index] ?? 0
    }
    return ms
}

function metricTotalsForLeaves(leafIds: string[], ctx: ComputeContext): MetricTotals {
    const totals: MetricTotals = { uncertainty: 0, complexity: 0, effort: 0 }

    for (const leafId of leafIds) {
        const leaf = ctx.byId.get(leafId)
        if (!leaf) continue
        totals.uncertainty += metricForType(leaf.uncertainty, leaf.uncertainty_can_estimate)
        totals.complexity += metricForType(leaf.complexity, leaf.complexity_can_estimate)
        totals.effort += metricForType(leaf.effort, leaf.effort_can_estimate)
    }

    return totals
}

function isSignificantOver(higher: number, lower: number): boolean {
    if (lower <= 0) return higher > 0
    return higher >= lower * SIGNIFICANCE_RATIO
}

export function determineTrophyType(totals: MetricTotals): TrophyType {
    const entries = METRIC_ORDER.map((key) => ({ key, total: totals[key] }))
    const sorted = [...entries].sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total
        return METRIC_ORDER.indexOf(a.key) - METRIC_ORDER.indexOf(b.key)
    })

    const [first, second, third] = sorted

    let significant: MetricKey[] = []
    if (first && first.total > 0) {
        if (isSignificantOver(first.total, second?.total ?? 0)) {
            significant = [first.key]
        } else if (isSignificantOver(second?.total ?? 0, third?.total ?? 0)) {
            significant = [first.key, second.key]
        }
    }

    // Canonicalize ordering so dual labels are stable regardless of tie ordering.
    significant = METRIC_ORDER.filter((key) => significant.includes(key))

    return buildTrophyType(significant)
}

function buildTrophyType(significant: MetricKey[]): TrophyType {
    if (significant.length === 0) {
        return {
            significant: [],
            key: 'progress',
            shortLabel: PROGRESS_TROPHY_META.name,
            label: `Trophy of ${PROGRESS_TROPHY_META.name}`,
            colors: [PROGRESS_TROPHY_META.color],
        }
    }

    const names = significant.map((key) => METRIC_TROPHY_META[key].name)
    const colors = significant.map((key) => METRIC_TROPHY_META[key].color)
    const shortLabel = names.join(' and ')

    return {
        significant,
        key: significant.join('+'),
        shortLabel,
        label: `Trophy of ${shortLabel}`,
        colors,
    }
}

/** All possible trophy type labels, used to populate filter/group option lists. */
export function allTrophyTypeShortLabels(): string[] {
    const labels = [
        METRIC_TROPHY_META.uncertainty.name,
        METRIC_TROPHY_META.complexity.name,
        METRIC_TROPHY_META.effort.name,
    ]

    const duals: MetricKey[][] = [
        ['uncertainty', 'complexity'],
        ['uncertainty', 'effort'],
        ['complexity', 'effort'],
    ]
    for (const pair of duals) {
        labels.push(pair.map((key) => METRIC_TROPHY_META[key].name).join(' and '))
    }

    labels.push(PROGRESS_TROPHY_META.name)
    return labels
}

function buildContext(
    tasks: TaskRecord[],
    terminalStatusIds: Set<string>,
    sessionTime: SessionTimeIndex | null,
): ComputeContext {
    const byId = new Map<string, TaskRecord>()
    const childrenByParent = new Map<string, TaskRecord[]>()

    for (const task of tasks) {
        byId.set(task.id, task)
    }

    for (const task of tasks) {
        if (task.parent_task_id && byId.has(task.parent_task_id)) {
            const siblings = childrenByParent.get(task.parent_task_id) ?? []
            siblings.push(task)
            childrenByParent.set(task.parent_task_id, siblings)
        }
    }

    return {
        byId,
        childrenByParent,
        terminalStatusIds,
        boundsMemo: new Map(),
        leafMemo: new Map(),
        subtreeMemo: new Map(),
        sessionTime,
    }
}

function buildTrophyView(task: TaskRecord, ctx: ComputeContext): TrophyView {
    const bounds = computeBounds(task.id, ctx)
    const leafIds = collectLeafDescendants(task.id, ctx)

    let completedValue = 0
    for (const leafId of leafIds) {
        const leaf = ctx.byId.get(leafId)
        if (!leaf) continue
        if (leaf.task_status_id && ctx.terminalStatusIds.has(leaf.task_status_id)) {
            completedValue += computeBounds(leafId, ctx).value
        }
    }

    const totalValue = bounds.value
    let progression: number
    if (totalValue > 0) {
        progression = completedValue / totalValue
    } else {
        const allCompleted =
            leafIds.length > 0 &&
            leafIds.every((leafId) => {
                const leaf = ctx.byId.get(leafId)
                return Boolean(leaf?.task_status_id && ctx.terminalStatusIds.has(leaf.task_status_id))
            })
        progression = allCompleted ? 1 : 0
    }

    const metricTotals = metricTotalsForLeaves(leafIds, ctx)
    const achieved = Boolean(
        task.task_status_id && ctx.terminalStatusIds.has(task.task_status_id),
    )
    const timeSpentMs = timeSpentForSubtree(collectSubtreeTaskIds(task.id, ctx), ctx)

    return {
        task,
        value: bounds.value,
        lower: bounds.lower,
        upper: bounds.upper,
        sizeOptimistic: bounds.upper,
        progression: Math.min(1, Math.max(0, progression)),
        achieved,
        timeSpentMs,
        type: determineTrophyType(metricTotals),
        contributingTaskIds: leafIds,
        metricTotals,
    }
}

/** Compute trophy views for every task flagged as a trophy. */
export function computeTrophies(
    tasks: TaskRecord[],
    terminalStatusIds: Set<string>,
    sessionTime: SessionTimeIndex | null = null,
): TrophyView[] {
    const ctx = buildContext(tasks, terminalStatusIds, sessionTime)
    return tasks
        .filter((task) => Number(task.is_trophy) === 1)
        .map((task) => buildTrophyView(task, ctx))
}

/** Compute trophy views keyed by task id (used by the progression graph). */
export function computeTrophyViewsByTaskId(
    tasks: TaskRecord[],
    terminalStatusIds: Set<string>,
    sessionTime: SessionTimeIndex | null = null,
): Map<string, TrophyView> {
    const ctx = buildContext(tasks, terminalStatusIds, sessionTime)
    const result = new Map<string, TrophyView>()
    for (const task of tasks) {
        if (Number(task.is_trophy) === 1) {
            result.set(task.id, buildTrophyView(task, ctx))
        }
    }
    return result
}
