import { defineConfig } from "drizzle-kit";

const MYSQL_DATABASE_URL = process.env.MYSQL_DATABASE_URL!;

export default defineConfig({
  schema: "./app/model/mysql/",
  out: `./system/generated/drizzle/mysql/`,
  dialect: "mysql",
  dbCredentials: { url: MYSQL_DATABASE_URL },
});
