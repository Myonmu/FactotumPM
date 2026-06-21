import type { TrophyView } from './computeTrophies'
import { resolveTrophyGroup, type TrophyGroupContext } from './trophyFields'

export type TrophyGroup = {
    key: string
    label: string
    views: TrophyView[]
}

/**
 * Bucket trophy views by the chosen grouping field. Groups are ordered by their
 * intrinsic sort key, then alphabetically by label. The incoming view order is
 * preserved within each group (sorting is applied upstream).
 */
export function groupTrophies(
    views: TrophyView[],
    groupField: string,
    ctx: TrophyGroupContext,
): TrophyGroup[] {
    if (!groupField || groupField === 'none') {
        return [{ key: '__all__', label: '', views: [...views] }]
    }

    const buckets = new Map<string, { label: string; sortKey: number; views: TrophyView[] }>()

    for (const view of views) {
        const group = resolveTrophyGroup(view, groupField, ctx)
        const existing = buckets.get(group.key)
        if (existing) {
            existing.views.push(view)
        } else {
            buckets.set(group.key, { label: group.label, sortKey: group.sortKey, views: [view] })
        }
    }

    return [...buckets.entries()]
        .sort((a, b) => {
            if (a[1].sortKey !== b[1].sortKey) return a[1].sortKey - b[1].sortKey
            return a[1].label.localeCompare(b[1].label, undefined, { sensitivity: 'base' })
        })
        .map(([key, value]) => ({ key, label: value.label, views: value.views }))
}
