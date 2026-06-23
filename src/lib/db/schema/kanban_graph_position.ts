import { real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { v4 as uuid } from 'uuid'
import project from './project'
import taskStatus from './task_status'

const kanbanGraphPosition = sqliteTable('kanban_graph_position', {
    id: text().primaryKey().$defaultFn(() => uuid()),
    project_id: text('project_id').references(() => project.id),
    task_status_id: text('task_status_id').notNull().references(() => taskStatus.id),
    pos_x: real('pos_x').notNull().default(0),
    pos_y: real('pos_y').notNull().default(0),
})

export default kanbanGraphPosition
