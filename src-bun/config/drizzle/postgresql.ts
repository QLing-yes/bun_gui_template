import { defineConfig } from "drizzle-kit";
import { ENV } from "../env";

/** PostgreSQL 迁移配置（路径相对 src-bun 运行目录解析）：`bun run db:generate:postgresql` / `db:migrate:postgresql` / `db:studio:postgresql` */
export default defineConfig({
  schema: "./app/model/postgresql/**/*.mold.ts",
  out: "./runtime/generated/drizzle/postgresql",
  dialect: "postgresql",
  dbCredentials: { url: ENV.PG_DATABASE_URL ?? "" },
});
