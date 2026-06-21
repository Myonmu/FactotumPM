/** null = unset, 0 = cannot estimate, 1 = has an estimate */
export type MetricCanEstimate = number | null

export function isMetricConfigured(canEstimate: MetricCanEstimate): boolean {
    return canEstimate != null
}

export function formatMetricDisplay(
    value: number | null,
    canEstimate: MetricCanEstimate,
): string | null {
    if (canEstimate == null) return null
    if (canEstimate === 0) return '?'
    if (value == null) return '?'
    return String(value)
}

export function readMetricCanEstimate(value: unknown): MetricCanEstimate {
    if (value == null || value === '') return null
    const numeric = Number(value)
    if (Number.isNaN(numeric)) return null
    return numeric === 0 ? 0 : 1
}
