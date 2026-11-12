import { getTableName, type Table } from "drizzle-orm";
import { createInsertSchema } from "drizzle-orm/typebox";

/** 字段描述注册表：表名 → { 字段: 描述 } */
export const columns_desc: Record<string, Record<string, string>> = {
  user: {
    id: "主键",
    username: "登录名（唯一）",
    email: "邮箱（唯一）",
    phone: "手机号（唯一）",
    passwordHash: "密码哈希",
    nickname: "显示名",
    avatar: "头像地址",
    status: "状态：1 正常，0 禁用",
    lastLoginAt: "最后登录时间",
    passwordChangedAt: "密码最近修改时间",
    createdAt: "创建时间",
    updatedAt: "更新时间",
  },
  role: {
    id: "主键",
    code: "角色标识（唯一）",
    name: "角色名称",
    description: "角色说明",
    level: "层级（越大越高）",
    isSystem: "是否内置角色",
    sort: "展示排序",
    status: "状态：1 启用，0 停用",
    createdAt: "创建时间",
    updatedAt: "更新时间",
  },
  user_role: {
    userId: "用户 ID",
    roleId: "角色 ID",
    createdAt: "授权时间",
  },
  role_permission: {
    roleId: "角色 ID",
    permCode: "接口权限编号",
    createdAt: "授权时间",
  },
  session: {
    id: "主键",
    userId: "所属用户 ID",
    tokenHash: "refresh token 哈希",
    userAgent: "登录设备信息",
    ip: "登录 IP",
    expiresAt: "过期时间",
    lastUsedAt: "最近使用时间",
    revokedAt: "撤销时间",
    createdAt: "创建时间",
  },
  post: {
    id: "主键",
    title: "标题",
    content: "正文",
    published: "是否发布",
    authorId: "作者 ID",
  },
};

/** 给 OpenAPI 文档增加表模型字段描述
 *  @param table drizzle 表
 *  @param desc 字段描述（不传则用 columns_desc 中该表的默认描述）
 *  @returns insert schema
 */
export function description<T extends Table>(
  table: T,
  desc?: Record<string, string>,
) {
  const schema = createInsertSchema(table);
  const fields = desc ?? columns_desc[getTableName(table)];
  if (!fields) return schema;
  const props = (schema as { properties?: Record<string, object> }).properties;
  if (!props) return schema;
  for (const [key, prop] of Object.entries(props)) {
    if (fields[key]) Object.assign(prop, { description: fields[key] });
  }
  return schema;
}
