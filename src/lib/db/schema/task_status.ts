import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { v4 as uuid } from 'uuid'
import project from './project'

const taskStatus = sqliteTable('task_status', {
    id: text()
        .primaryKey()
        .$defaultFn(() => uuid()),
    name: text('name').notNull(),
    description: text('description'),
    pos_x: real('pos_x').notNull().default(0),
    pos_y: real('pos_y').notNull().default(0),
    kanban_pos_x: real('kanban_pos_x'),
    kanban_pos_y: real('kanban_pos_y'),
    is_initial: integer('is_initial', { mode: 'boolean' }).notNull().default(false),
    is_terminal: integer('is_terminal', { mode: 'boolean' }).notNull().default(false),
    color: integer('color'),
    project_id: text('project_id').references(() => project.id),
})

export default taskStatus
