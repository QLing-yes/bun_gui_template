import {
  index,
  integer,
  primaryKey,
  sqliteTable,
} from "drizzle-orm/sqlite-core";
import { description } from "@/app/model/describe";
import { table as roleTable } from "./role.mold";
import { table as userTable } from "./user.mold";

export const table = sqliteTable(
  "user_role",
  {
    /** 用户 ID */
    userId: integer("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    /** 角色 ID */
    roleId: integer("role_id")
      .notNull()
      .references(() => roleTable.id, { onDelete: "cascade" }),
    /** 授权时间（毫秒时间戳） */
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.roleId] }),
    index("user_role_role_idx").on(t.roleId),
  ],
);

export const schema = description(table);
