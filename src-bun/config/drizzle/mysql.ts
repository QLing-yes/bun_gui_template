import { defineConfig } from "drizzle-kit";
import { ENV } from "../env";

/**
 * MySQL 迁移配置（默认方言），路径相对 src-bun 运行目录解析。
 * 每方言一份配置文件：config/drizzle/mysql.ts / postgresql.ts / sqlite.ts，
 * schema 指向 `app/model/<方言>`，out 指向 `runtime/generated/drizzle/<方言>`；
 * 其它方言用 `bun run db:generate:postgresql` / `bun run db:generate:sqlite` 这类方式指定。
 */
export default defineConfig({
  schema: "./app/model/mysql/**/*.mold.ts",
  out: "./runtime/generated/drizzle/mysql",
  dialect: "mysql",
  dbCredentials: { url: ENV.MYSQL_DATABASE_URL },
});
