export {default as task} from './task'

export {default as domain} from './domain'

export {default as session} from './session'

export {default as sessionEdge} from './session_edge'

export {default as aftermath} from './aftermath'

export {default as taskStatus} from './task_status'

export {default as taskStatusEdge} from './task_status_edge'

export {default as taskDependency} from './task_dependency'



/** User-facing tables shown in Data View, in display order. */

export const APP_TABLE_ORDER = [

    'task',

    'task_dependency',

    'task_status',

    'task_status_edge',

    'domain',

    'session',

    'session_edge',

    'aftermath',

] as const

export type AppTableName = (typeof APP_TABLE_ORDER)[number]

