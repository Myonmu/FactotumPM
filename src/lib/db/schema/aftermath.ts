import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import {v4 as uuid} from 'uuid'
import project from './project'

const aftermath = sqliteTable('aftermath', {
    id: text().primaryKey().$defaultFn(() => uuid()),
    score: integer('score'),
    description: text('description'),
    icon: text('icon'),
    color: integer('color'),
    project_id: text('project_id').references(() => project.id),
})

export default aftermath
