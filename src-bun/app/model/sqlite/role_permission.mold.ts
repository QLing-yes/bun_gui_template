import {
  index,
  integer,
  primaryKey,
  sqliteTable,
} from "drizzle-orm/sqlite-core";
import { description } from "@/app/model/describe";
import { table as roleTable } from "./role.mold";

export const table = sqliteTable(
  "role_permission",
  {
    /** 角色 ID */
    roleId: integer("role_id")
      .notNull()
      .references(() => roleTable.id, { onDelete: "cascade" }),
    /** 接口权限编号（对应路由 macro `perm(code)`，无外键，靠启动校验兜底） */
    permCode: integer("perm_code").notNull(),
    /** 授权时间（毫秒时间戳） */
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.roleId, t.permCode] }),
    index("role_permission_code_idx").on(t.permCode),
  ],
);

export const schema = description(table);
