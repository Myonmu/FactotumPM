export type DashboardView =
    | { kind: 'main' }
    | { kind: 'aftermath'; sessionId: string }

const MAIN_VIEW: DashboardView = { kind: 'main' }

let currentView = $state<DashboardView>(MAIN_VIEW)
let backStack = $state<DashboardView[]>([])
let forwardStack = $state<DashboardView[]>([])

function viewsEqual(left: DashboardView, right: DashboardView): boolean {
    if (left.kind !== right.kind) return false
    if (left.kind === 'aftermath' && right.kind === 'aftermath') {
        return left.sessionId === right.sessionId
    }
    return true
}

export function getDashboardView(): DashboardView {
    return currentView
}

export function getDashboardNav() {
    return {
        canGoBack: backStack.length > 0,
        canGoForward: forwardStack.length > 0,
        isAftermath: currentView.kind === 'aftermath',
        aftermathSessionId:
            currentView.kind === 'aftermath' ? currentView.sessionId : null,
    }
}

export function resetDashboardNav() {
    currentView = MAIN_VIEW
    backStack = []
    forwardStack = []
}

export function openAftermathView(sessionId: string) {
    const nextView: DashboardView = { kind: 'aftermath', sessionId }
    if (viewsEqual(currentView, nextView)) return

    backStack = [...backStack, currentView]
    forwardStack = []
    currentView = nextView
}

export function navigateDashboardBack() {
    if (backStack.length === 0) return

    const previous = backStack[backStack.length - 1]
    backStack = backStack.slice(0, -1)
    forwardStack = [...forwardStack, currentView]
    currentView = previous
}

export function navigateDashboardForward() {
    if (forwardStack.length === 0) return

    const next = forwardStack[forwardStack.length - 1]
    forwardStack = forwardStack.slice(0, -1)
    backStack = [...backStack, currentView]
    currentView = next
}

export function returnToDashboardMain() {
    if (currentView.kind === 'main') return

    backStack = [...backStack, currentView]
    forwardStack = []
    currentView = MAIN_VIEW
}
