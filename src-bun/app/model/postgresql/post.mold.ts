import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  varchar,
} from "drizzle-orm/pg-core";
import { description } from "@/app/model/describe";

export const table = pgTable("post", {
  id: serial().primaryKey(),
  title: varchar({ length: 255 }).notNull(),
  content: text(),
  published: boolean().notNull().default(false),
  authorId: integer("author_id").notNull(),
});

export const schema = description(table);
