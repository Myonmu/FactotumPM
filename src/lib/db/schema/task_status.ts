import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { v4 as uuid } from 'uuid'

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
    is_initial: integer('is_initial').default(0),
    is_terminal: integer('is_terminal').default(0),
    color: integer('color'),
})

export default taskStatus
