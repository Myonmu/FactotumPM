import { getPrefString, savePrefString } from '$lib/prefStore'
import {
    createProject,
    deleteProject,
    loadProjects,
    updateProject,
    type ProjectRecord,
} from '$lib/db/projects'

const LAST_PROJECT_PREF = 'lastProjectId'
const ALL_PROJECTS_VALUE = '__all__'

let currentProjectId = $state<string | null>(null)
let projects = $state<ProjectRecord[]>([])
let projectsLoaded = $state(false)
let initInFlight: Promise<void> | null = null

/** null = All Projects mode */
export function getCurrentProjectId(): string | null {
    return currentProjectId
}

export function getProjects(): ProjectRecord[] {
    return projects
}

export function isProjectsLoaded(): boolean {
    return projectsLoaded
}

export function getCurrentProject(): ProjectRecord | null {
    if (currentProjectId == null) return null
    return projects.find((p) => p.id === currentProjectId) ?? null
}

export function resetProjectState(): void {
    currentProjectId = null
    projects = []
    projectsLoaded = false
    initInFlight = null
}

export async function initProjectState(): Promise<void> {
    if (initInFlight) return initInFlight

    initInFlight = (async () => {
        await refreshProjects()
        const saved = await getPrefString(LAST_PROJECT_PREF)
        if (saved && saved !== ALL_PROJECTS_VALUE) {
            const exists = projects.some((p) => p.id === saved)
            if (exists) {
                currentProjectId = saved
            } else {
                currentProjectId = null
            }
        } else {
            currentProjectId = null
        }
        projectsLoaded = true
    })()

    try {
        await initInFlight
    } finally {
        initInFlight = null
    }
}

export async function selectProject(id: string | null): Promise<void> {
    currentProjectId = id
    await savePrefString(LAST_PROJECT_PREF, id ?? ALL_PROJECTS_VALUE)
}

export async function refreshProjects(): Promise<void> {
    projects = await loadProjects()
}

export async function createAndSelectProject(input: {
    name: string
    description?: string | null
    color?: number | null
    icon?: string | null
}): Promise<ProjectRecord> {
    const created = await createProject(input)
    await refreshProjects()
    await selectProject(created.id)
    return created
}

export async function updateCurrentProject(
    id: string,
    patch: Partial<Pick<ProjectRecord, 'name' | 'description' | 'color' | 'icon'>>,
): Promise<void> {
    await updateProject(id, patch)
    await refreshProjects()
}

export async function deleteProjectAndReset(id: string): Promise<void> {
    await deleteProject(id)
    await refreshProjects()
    if (currentProjectId === id) {
        await selectProject(null)
    }
}
