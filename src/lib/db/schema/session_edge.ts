import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { v4 as uuid } from 'uuid'

import session from './session'
import task from './task'

const sessionEdge = sqliteTable('session_edge', {
    id: text()
        .primaryKey()
        .$defaultFn(() => uuid()),
    session_id: text('session_id')
        .notNull()
        .references(() => session.id, { onDelete: 'cascade' }),
    task_id: text('task_id')
        .notNull()
        .references(() => task.id, { onDelete: 'cascade' }),
})

export default sessionEdge
