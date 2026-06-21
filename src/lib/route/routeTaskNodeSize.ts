import type { TaskRecord } from '$lib/db/dataView'
import { isMetricConfigured } from '$lib/taskMetrics'

import { ROUTE_NODE_WIDTH } from './types'

const TITLE_CHARS_PER_LINE = 28
const DESC_CHARS_PER_LINE = 34
const TITLE_LINE_HEIGHT = 20
const DESC_LINE_HEIGHT = 17
const METRICS_ROW_HEIGHT = 24
const CARD_VERTICAL_PADDING = 16
const CARD_SECTION_GAP = 4
/** Room for border rendering and sub-pixel rounding inside the fixed node box. */
const CARD_EDGE_BUFFER = 2

function taskShowsMetrics(task: TaskRecord): boolean {
    return (
        isMetricConfigured(task.uncertainty_can_estimate)
        || isMetricConfigured(task.complexity_can_estimate)
        || isMetricConfigured(task.effort_can_estimate)
    )
}

function estimateTitleLineCount(title: string): number {
    const normalized = title.trim() || 'Untitled task'
    return Math.min(2, Math.max(1, Math.ceil(normalized.length / TITLE_CHARS_PER_LINE)))
}

function estimateDescriptionLineCount(description: string | null | undefined): number {
    const normalized = description?.trim()
    if (!normalized) return 0
    return Math.min(2, Math.max(1, Math.ceil(normalized.length / DESC_CHARS_PER_LINE)))
}

/** Height tiers aligned with RouteTaskCard (2-line title, 2-line description). */
export function estimateRouteTaskNodeSize(task: TaskRecord): { width: number; height: number } {
    const width = ROUTE_NODE_WIDTH
    const titleLines = estimateTitleLineCount(task.title)
    const descriptionLines = estimateDescriptionLineCount(task.description)

    let height = CARD_VERTICAL_PADDING + titleLines * TITLE_LINE_HEIGHT

    if (descriptionLines > 0) {
        height += CARD_SECTION_GAP + descriptionLines * DESC_LINE_HEIGHT
    }

    if (taskShowsMetrics(task)) {
        height += CARD_SECTION_GAP + METRICS_ROW_HEIGHT
    }

    height += CARD_EDGE_BUFFER

    return { width, height }
}
