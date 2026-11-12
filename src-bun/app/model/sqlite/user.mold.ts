import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { description } from "@/app/model/describe";

export const table = sqliteTable("user", {
  id: integer().primaryKey({ autoIncrement: true }),
  email: text({ length: 255 }).notNull().unique(),
  name: text({ length: 255 }),
});

export const schema = description(table);
