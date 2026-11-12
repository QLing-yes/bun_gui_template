import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { description } from "@/app/model/describe";

export const table = sqliteTable(
  "role",
  {
    /** 主键 */
    id: integer().primaryKey({ autoIncrement: true }),
    /** 稳定标识（super_admin / admin / user，代码只认该字段） */
    code: text({ length: 64 }).notNull().unique(),
    /** 显示名 */
    name: text({ length: 64 }).notNull(),
    /** 角色说明 */
    description: text({ length: 255 }),
    /** 层级：越大越高，用于判断谁能管理谁（超管 100 / 管理员 50 / 普通 10） */
    level: integer().notNull().default(0),
    /** 是否内置角色：内置角色禁止删除 */
    isSystem: integer("is_system", { mode: "boolean" })
      .notNull()
      .default(false),
    /** 展示排序 */
    sort: integer().notNull().default(0),
    /** 状态：1 启用，0 停用 */
    status: integer().notNull().default(1),
    /** 创建时间（毫秒时间戳） */
    createdAt: integer("created_at").notNull(),
    /** 更新时间（毫秒时间戳） */
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    index("role_level_idx").on(t.level),
    index("role_status_idx").on(t.status),
  ],
);

export const schema = description(table);
