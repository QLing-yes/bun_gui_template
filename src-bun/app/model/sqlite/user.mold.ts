import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { description } from "@/app/model/describe";

export const table = sqliteTable(
  "user",
  {
    /** 主键 */
    id: integer().primaryKey({ autoIncrement: true }),
    /** 登录名（必填、唯一，写入前统一小写） */
    username: text({ length: 64 }).notNull(),
    /** 邮箱（唯一、可空，写入前统一小写） */
    email: text({ length: 255 }),
    /** 手机号（唯一、可空，只存纯数字） */
    phone: text({ length: 32 }),
    /** 密码哈希（Bun.password argon2id） */
    passwordHash: text("password_hash").notNull(),
    /** 显示名 */
    nickname: text({ length: 64 }),
    /** 头像地址 */
    avatar: text({ length: 512 }),
    /** 状态：1 正常，0 禁用 */
    status: integer().notNull().default(1),
    /** 最后登录时间（毫秒时间戳） */
    lastLoginAt: integer("last_login_at"),
    /** 密码最近修改时间（毫秒时间戳），用于失效旧会话 */
    passwordChangedAt: integer("password_changed_at").notNull(),
    /** 创建时间（毫秒时间戳） */
    createdAt: integer("created_at").notNull(),
    /** 更新时间（毫秒时间戳） */
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("user_username_uq").on(t.username),
    uniqueIndex("user_email_uq").on(t.email),
    uniqueIndex("user_phone_uq").on(t.phone),
    index("user_status_idx").on(t.status),
  ],
);

export const schema = description(table);
