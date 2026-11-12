import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { description } from "@/app/model/describe";
import { table as userTable } from "./user.mold";

export const table = sqliteTable(
  "session",
  {
    /** 主键 */
    id: integer().primaryKey({ autoIncrement: true }),
    /** 所属用户 ID */
    userId: integer("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    /** refresh token 的 SHA-256（不存明文） */
    tokenHash: text("token_hash").notNull().unique(),
    /** 登录设备信息 */
    userAgent: text("user_agent"),
    /** 登录 IP */
    ip: text({ length: 64 }),
    /** 过期时间（毫秒时间戳） */
    expiresAt: integer("expires_at").notNull(),
    /** 最近使用时间（毫秒时间戳） */
    lastUsedAt: integer("last_used_at").notNull(),
    /** 撤销时间（毫秒时间戳），非空即失效 */
    revokedAt: integer("revoked_at"),
    /** 创建时间（毫秒时间戳） */
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("session_user_idx").on(t.userId),
    index("session_expires_idx").on(t.expiresAt),
  ],
);

export const schema = description(table);
