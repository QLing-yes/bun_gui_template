import { drizzle as orm } from "drizzle-orm/mysql2";
import { client } from "@/app/lib/mysql";
import { relations } from "./relations";

/** MySQL 的 drizzle ORM 实例（绑定表关系，经 $g.mysql 使用；其它方言同目录结构导出一份即可） */
export const db = orm({ client, relations });
