import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { description } from "@/app/model/describe";

export const table = sqliteTable("post", {
  id: integer().primaryKey({ autoIncrement: true }),
  title: text({ length: 255 }).notNull(),
  content: text(),
  published: integer({ mode: "boolean" }).notNull().default(false),
  authorId: integer("author_id").notNull(),
});

export const schema = description(table);
