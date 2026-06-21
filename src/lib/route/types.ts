export type RouteGraphView = {
    /** When null, the full task graph is shown. */
    filterTaskIds: string[] | null
    anchorTaskId: string | null
}

export const ROUTE_NODE_WIDTH = 260

/** Reserved tab strip height in package nodes (must match RoutePackageNode). */
export const ROUTE_PACKAGE_TAB_HEIGHT = 44
/** Vertical gap between tab strip and first contained node. */
export const ROUTE_PACKAGE_CONTENT_GAP = 20
export const ROUTE_PACKAGE_PADDING = 16
export const ROUTE_PACKAGE_BOTTOM_PADDING = 16
export const ROUTE_CHILD_GAP = 16

export const ROUTE_PACKAGE_CONTENT_TOP =
    ROUTE_PACKAGE_TAB_HEIGHT + ROUTE_PACKAGE_CONTENT_GAP

export const ROUTE_PACKAGE_MIN_WIDTH = ROUTE_NODE_WIDTH + ROUTE_PACKAGE_PADDING * 2
export const ROUTE_PACKAGE_MIN_HEIGHT =
    ROUTE_PACKAGE_CONTENT_TOP + ROUTE_PACKAGE_BOTTOM_PADDING

/** Extra space so nested packages stay inside their parent border. */
export const ROUTE_PACKAGE_LAYOUT_BUFFER = 18

/** @deprecated Use estimateRouteTaskNodeSize instead. */
export const ROUTE_NODE_HEIGHT = 72
