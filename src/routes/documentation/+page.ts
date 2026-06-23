import type { PageLoad } from './$types'

export const load: PageLoad = async ({ fetch }) => {
    const response = await fetch('/Documentation.md')

    if (!response.ok) {
        return {
            markdown: '# Documentation\n\nDocumentation could not be loaded.',
        }
    }

    return {
        markdown: await response.text(),
    }
}
