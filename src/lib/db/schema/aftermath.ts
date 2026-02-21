import {sql} from 'drizzle-orm'
import {type AnySQLiteColumn, blob, integer, sqliteTable, text} from 'drizzle-orm/sqlite-core'
import {v4 as uuid} from 'uuid'

const aftermath = sqliteTable('aftermath', {
    id: text().primaryKey().$defaultFn(() => uuid()),
    score: integer('score'), // satisfaction score
    description: text('description'),
    icon: text('icon'), // actually emoji?
    color: integer('color'),
})

export default aftermath
