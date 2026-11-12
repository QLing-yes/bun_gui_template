import { drizzle as orm } from "drizzle-orm/bun-sql";
import { client } from "@/app/lib/postgresql";
import { relations } from "./relations";

/** PostgreSQL 的 drizzle ORM 实例（经 $g.pg 使用） */
export const db = orm({ client, relations });
