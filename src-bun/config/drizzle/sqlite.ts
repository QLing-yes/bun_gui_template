import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { defineConfig } from "drizzle-kit";
import { ENV } from "../env";

// 首次迁移时库文件目录可能不存在（drizzle-kit 不会自动创建），先补建父目录
mkdirSync(dirname(resolve(ENV.SQLITE_DATABASE_PATH)), { recursive: true });

/** SQLite 迁移配置（路径相对 src-bun 运行目录解析）：`bun run db:generate:sqlite` / `db:migrate:sqlite` / `db:studio:sqlite` */
export default defineConfig({
  schema: "./app/model/sqlite/**/*.mold.ts",
  out: "./runtime/generated/drizzle/sqlite",
  dialect: "sqlite",
  dbCredentials: { url: ENV.SQLITE_DATABASE_PATH },
});
