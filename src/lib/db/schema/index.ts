export {default as task} from './task'

export {default as domain} from './domain'

export {default as session} from './session'

export {default as sessionEdge} from './session_edge'

export {default as aftermath} from './aftermath'

export {default as taskStatus} from './task_status'

export {default as taskStatusEdge} from './task_status_edge'

export {default as taskDependency} from './task_dependency'

export {default as observation} from './observation'

export {default as project} from './project'

export {default as kanbanGraphPosition} from './kanban_graph_position'



/** User-facing tables shown in Data View, in display order. */

export const APP_TABLE_ORDER = [

    'project',

    'task',

    'task_dependency',

    'task_status',

    'task_status_edge',

    'domain',

    'session',

    'session_edge',

    'aftermath',

    'observation',

] as const

export type AppTableName = (typeof APP_TABLE_ORDER)[number]

