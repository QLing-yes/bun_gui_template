import { defineConfig } from "drizzle-kit";

const MYSQL_DATABASE_URL = process.env.MYSQL_DATABASE_URL!;

/**
 * MySQL 迁移配置（默认方言）。
 * 每方言一份配置文件：drizzle.config.mysql.ts / drizzle.config.postgresql.ts / drizzle.config.sqlite.ts，
 * schema 指向 `app/model/<方言>`，out 指向 `system/generated/drizzle/<方言>`；
 * 其它方言用 `bun run db:generate:postgresql` / `bun run db:generate:sqlite` 这类方式指定。
 */
export default defineConfig({
  schema: "./app/model/mysql/**/*.mold.ts",
  out: "./system/generated/drizzle/mysql",
  dialect: "mysql",
  dbCredentials: { url: MYSQL_DATABASE_URL },
});
