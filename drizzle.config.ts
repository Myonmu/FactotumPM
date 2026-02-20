import { defineConfig } from 'drizzle-kit'

export default defineConfig({
    dialect: 'sqlite',
    schema: './src/db/schema',
    out: './tauri/migrations',
    verbose: false,
    strict: true,
    casing: 'snake_case',
    migrations: { prefix: 'supabase' },
})
