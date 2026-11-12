import { getTableName, type Table } from "drizzle-orm";
import { createInsertSchema } from "drizzle-orm/typebox";

/** 字段描述注册表：表名 → { 字段: 描述 } */
export const columns_desc: Record<string, Record<string, string>> = {
  user: {
    id: "主键",
    email: "邮箱（唯一）",
    name: "用户名",
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
