import { defineConfig } from "drizzle-kit";

const PG_DATABASE_URL = process.env.PG_DATABASE_URL!;

/** PostgreSQL 迁移配置：`bun run db:generate:postgresql` / `db:migrate:postgresql` / `db:studio:postgresql` */
export default defineConfig({
  schema: "./app/model/postgresql/**/*.mold.ts",
  out: "./system/generated/drizzle/postgresql",
  dialect: "postgresql",
  dbCredentials: { url: PG_DATABASE_URL },
});
