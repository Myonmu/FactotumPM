import { colorIntToHex } from '$lib/grid/colorUtils'

export const DEFAULT_STATUS_EDGE_COLOR = 0x808080

export const DEFAULT_STATUS_EDGE_COLOR_HEX =
    colorIntToHex(DEFAULT_STATUS_EDGE_COLOR) ?? '#808080'

function normalizeColorInt(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
        return null
    }

    const numeric = typeof value === 'number' ? value : Number(value)
    if (Number.isNaN(numeric)) {
        return null
    }

    return numeric & 0xffffff
}

/** Edge color: explicit edge color, else destination status color, else default gray. */
export function getStatusEdgeColorInt(
    edgeColor: number | null | undefined,
    destinationStatusColor: number | null | undefined,
): number {
    return (
        normalizeColorInt(edgeColor)
        ?? normalizeColorInt(destinationStatusColor)
        ?? DEFAULT_STATUS_EDGE_COLOR
    )
}

export function getStatusEdgeColorHex(
    edgeColor: number | null | undefined,
    destinationStatusColor: number | null | undefined,
): string {
    return colorIntToHex(
        getStatusEdgeColorInt(edgeColor, destinationStatusColor),
    ) ?? DEFAULT_STATUS_EDGE_COLOR_HEX
}
