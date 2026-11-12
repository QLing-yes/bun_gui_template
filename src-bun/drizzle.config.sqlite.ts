import { defineConfig } from "drizzle-kit";

const SQLITE_DATABASE_PATH = process.env.SQLITE_DATABASE_PATH!;

/** SQLite 迁移配置：`bun run db:generate:sqlite` / `db:migrate:sqlite` / `db:studio:sqlite` */
export default defineConfig({
  schema: "./app/model/sqlite/**/*.mold.ts",
  out: "./system/generated/drizzle/sqlite",
  dialect: "sqlite",
  dbCredentials: { url: SQLITE_DATABASE_PATH },
});
