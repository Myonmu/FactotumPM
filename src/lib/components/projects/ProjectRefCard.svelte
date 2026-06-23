<script lang="ts">
    import { FolderKanban } from 'lucide-svelte'

    import LucideIcon from '$lib/components/LucideIcon.svelte'
    import RefCardHoverPreview from '$lib/components/RefCardHoverPreview.svelte'
    import ProjectRefCardPreview from '$lib/components/projects/ProjectRefCardPreview.svelte'
    import { refCardRootClass } from '$lib/components/refCardHover'
    import type { ProjectRef } from '$lib/db/projects'
    import { colorIntToHex } from '$lib/grid/colorUtils'

    let {
        project,
        class: className = '',
        hoverPreviewDisabled = false,
        fullWidth = false,
    }: {
        project: ProjectRef
        class?: string
        hoverPreviewDisabled?: boolean
        fullWidth?: boolean
    } = $props()

    const colorHex = $derived(project.color ? colorIntToHex(project.color) : null)
    const cardBaseClass =
        'project-ref-card flex min-h-8 items-center gap-2 rounded border border-base-300 bg-base-100 px-2 py-1'
    const widthClass = $derived(fullWidth || className.includes('w-full') ? 'w-full' : '')
</script>

<RefCardHoverPreview disabled={hoverPreviewDisabled} anchorClass={widthClass}>
    {#snippet children(expanded)}
        {#if expanded}
            <ProjectRefCardPreview {project} />
        {:else}
            <div
                    class="{refCardRootClass(cardBaseClass, className, expanded)} {widthClass}"
                    style:border-left-color={colorHex ?? undefined}
                    style:border-left-width={colorHex ? '3px' : undefined}
                    data-project-id={project.id}
            >
                {#if project.icon}
                    <LucideIcon name={project.icon} size={16} color={project.color} />
                {:else}
                    <span class="inline-flex shrink-0" style:color={colorHex ?? undefined}>
                        <FolderKanban class="h-4 w-4" />
                    </span>
                {/if}
                <span
                        class="min-w-0 flex-1 text-sm font-medium leading-snug"
                        class:truncate={!expanded}
                        class:whitespace-normal={expanded}
                >{project.name}</span>
            </div>
        {/if}
    {/snippet}
</RefCardHoverPreview>
