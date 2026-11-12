import { drizzle as orm } from "drizzle-orm/bun-sqlite";
import { client } from "@/app/lib/sqlite";
import { relations } from "./relations";

/** SQLite 的 drizzle ORM 实例（经 $g.sqlite 使用） */
export const db = orm({ client, relations });
