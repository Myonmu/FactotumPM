import { invoke } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'

import { getPrefJson, getPrefString, savePrefJson, savePrefString } from '$lib/prefStore'

import type { PromptEntry, PromptRegistry, ResolvedPromptEntry } from './types'

const REGISTRY_KEY = 'promptRegistry'
const SELECTED_PROMPT_KEY = 'llm.selectedPromptId'

type RegisteredPath = {
    name: string
    relative_path: string
    absolute_path: string
}

type ResolvedStoredPath = {
    resolved_path: string
    exists: boolean
}

const DEFAULT_PROMPT_FILES: Array<{
    fileName: string
    name: string
    description: string
}> = [
    {
        fileName: 'task-suggestion.md',
        name: 'Task suggestion',
        description: 'Mood-based task picks with domain variety',
    },
    {
        fileName: 'data-explorer.md',
        name: 'Data explorer',
        description: 'Explore and present any queryable project data',
    },
    {
        fileName: 'learn.md',
        name: 'Learn',
        description: 'Analyze session patterns and save behavioral observations',
    },
]

function createId(): string {
    return crypto.randomUUID()
}

function titleCaseFromFileName(fileName: string): string {
    return fileName
        .replace(/\.md$/i, '')
        .split(/[-_]+/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
}

async function registerPromptsDirFile(
    promptsDir: string,
    fileName: string,
    meta: { name: string; description: string },
): Promise<PromptEntry> {
    const absolutePath = `${promptsDir.replace(/\\/g, '/').replace(/\/$/, '')}/${fileName}`
    const registered = await invoke<RegisteredPath>('register_db_path', {
        absolutePath,
    })

    return {
        id: createId(),
        name: meta.name,
        description: meta.description,
        relativePath: registered.relative_path,
        absolutePath: registered.absolute_path,
        isDefault: true,
    }
}

async function seedDefaultPromptEntries(promptsDir: string): Promise<PromptEntry[]> {
    await invoke<string[]>('ensure_default_prompts')

    const entries: PromptEntry[] = []
    for (const spec of DEFAULT_PROMPT_FILES) {
        entries.push(await registerPromptsDirFile(promptsDir, spec.fileName, spec))
    }
    return entries
}

function entryFileName(entry: PromptEntry): string {
    const path = entry.relativePath || entry.absolutePath
    return path.split(/[/\\]/).pop() ?? ''
}

async function ensureMissingDefaultPrompts(registry: PromptRegistry): Promise<PromptRegistry> {
    const promptsDir = await invoke<string>('get_prompts_dir')
    await invoke<string[]>('ensure_default_prompts')

    const existingFiles = new Set(registry.entries.map(entryFileName))
    const missing = DEFAULT_PROMPT_FILES.filter((spec) => !existingFiles.has(spec.fileName))
    if (missing.length === 0) {
        return registry
    }

    const entries = [...registry.entries]
    for (const spec of missing) {
        entries.push(await registerPromptsDirFile(promptsDir, spec.fileName, spec))
    }

    const next = { ...registry, entries }
    await savePromptRegistry(next)
    return next
}

export async function reloadBundledPrompts(): Promise<string[]> {
    return invoke<string[]>('reload_bundled_prompts')
}

/** Re-copy bundled default prompts and refresh registry entries from disk. */
export async function reloadPromptRegistry(): Promise<PromptRegistry> {
    await reloadBundledPrompts()
    return loadPromptRegistry()
}

export async function loadPromptRegistry(): Promise<PromptRegistry> {
    const promptsDir = await invoke<string>('get_prompts_dir')
    const stored = await getPrefJson<PromptRegistry>(REGISTRY_KEY)

    let registry: PromptRegistry = stored?.entries
        ? stored
        : { entries: [], lastSelectedId: null }

    if (registry.entries.length === 0) {
        registry = {
            entries: await seedDefaultPromptEntries(promptsDir),
            lastSelectedId: null,
        }
        await savePromptRegistry(registry)
    } else {
        registry = await ensureMissingDefaultPrompts(registry)
    }

    return registry
}

export async function savePromptRegistry(registry: PromptRegistry): Promise<void> {
    await savePrefJson(REGISTRY_KEY, registry)
}

export async function resolvePromptEntry(
    entry: PromptEntry,
): Promise<ResolvedPromptEntry> {
    const resolved = await invoke<ResolvedStoredPath>('resolve_stored_path', {
        relativePath: entry.relativePath,
        absolutePath: entry.absolutePath,
    })

    return {
        ...entry,
        resolvedPath: resolved.resolved_path,
        isValid: resolved.exists,
    }
}

export async function resolveAllPromptEntries(
    registry: PromptRegistry,
): Promise<ResolvedPromptEntry[]> {
    return Promise.all(registry.entries.map(resolvePromptEntry))
}

export async function readPromptEntry(entry: ResolvedPromptEntry): Promise<string> {
    const path = entry.isValid ? entry.resolvedPath : entry.absolutePath
    return invoke<string>('read_text_file', {
        relativePath: entry.relativePath,
        absolutePath: path,
    })
}

export async function writePromptEntry(
    entry: ResolvedPromptEntry,
    content: string,
): Promise<void> {
    await invoke('write_text_file', {
        relativePath: entry.relativePath,
        absolutePath: entry.absolutePath,
        content,
    })
}

export async function registerPromptPath(absolutePath: string): Promise<PromptEntry> {
    const registered = await invoke<RegisteredPath>('register_db_path', {
        absolutePath,
    })

    return {
        id: createId(),
        name: titleCaseFromFileName(registered.name),
        relativePath: registered.relative_path,
        absolutePath: registered.absolute_path,
    }
}

export async function addPromptEntry(entry: PromptEntry): Promise<PromptRegistry> {
    const registry = await loadPromptRegistry()
    const exists = registry.entries.some(
        (existing) =>
            existing.absolutePath === entry.absolutePath ||
            (!!entry.relativePath && existing.relativePath === entry.relativePath),
    )

    if (!exists) {
        registry.entries = [...registry.entries, entry]
    }

    await savePromptRegistry(registry)
    return registry
}

export async function removePromptEntry(entryId: string): Promise<PromptRegistry> {
    const registry = await loadPromptRegistry()
    const entry = registry.entries.find((item) => item.id === entryId)
    if (!entry || entry.isDefault) {
        return registry
    }

    registry.entries = registry.entries.filter((item) => item.id !== entryId)
    if (registry.lastSelectedId === entryId) {
        registry.lastSelectedId = registry.entries[0]?.id ?? null
    }

    await savePromptRegistry(registry)
    return registry
}

export async function updatePromptEntryPath(
    entryId: string,
    absolutePath: string,
): Promise<PromptRegistry> {
    const registered = await invoke<RegisteredPath>('register_db_path', {
        absolutePath,
    })
    const registry = await loadPromptRegistry()

    registry.entries = registry.entries.map((entry) =>
        entry.id === entryId
            ? {
                  ...entry,
                  name: titleCaseFromFileName(registered.name),
                  relativePath: registered.relative_path,
                  absolutePath: registered.absolute_path,
              }
            : entry,
    )

    await savePromptRegistry(registry)
    return registry
}

export async function getSelectedPromptId(): Promise<string | null> {
    return getPrefString(SELECTED_PROMPT_KEY)
}

export async function setSelectedPromptId(entryId: string): Promise<void> {
    await savePrefString(SELECTED_PROMPT_KEY, entryId)

    const registry = await loadPromptRegistry()
    registry.lastSelectedId = entryId
    await savePromptRegistry(registry)
}

export async function pickPromptFile(): Promise<string | null> {
    const selected = await open({
        multiple: false,
        directory: false,
        filters: [{ name: 'Markdown prompt', extensions: ['md', 'txt'] }],
    })

    return typeof selected === 'string' ? selected : null
}

export async function pickNewPromptSavePath(): Promise<string | null> {
    const selected = await save({
        filters: [{ name: 'Markdown prompt', extensions: ['md'] }],
        defaultPath: 'my-prompt.md',
    })

    return typeof selected === 'string' ? selected : null
}

export function pickDefaultPromptEntry(
    entries: ResolvedPromptEntry[],
    lastSelectedId: string | null,
): ResolvedPromptEntry | null {
    if (!entries.length) return null

    if (lastSelectedId) {
        const selected = entries.find((entry) => entry.id === lastSelectedId)
        if (selected) return selected
    }

    return entries.find((entry) => entry.isValid) ?? entries[0]
}

export function isStalePromptEntry(entry: ResolvedPromptEntry): boolean {
    return !entry.isValid
}
