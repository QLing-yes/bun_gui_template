import { pgTable, serial, varchar } from "drizzle-orm/pg-core";
import { description } from "@/app/model/describe";

export const table = pgTable("user", {
  id: serial().primaryKey(),
  email: varchar({ length: 255 }).notNull().unique(),
  name: varchar({ length: 255 }),
});

export const schema = description(table);
