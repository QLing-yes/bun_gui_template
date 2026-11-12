import { defineRelations } from "drizzle-orm";
import * as schema from "@/runtime/generated/model/sqlite";

export const relations = defineRelations(schema, (r) => ({
  user: {
    posts: r.many.post(),
    /** 用户绑定的角色（多对多，经 user_role） */
    roles: r.many.role({
      from: r.user.id.through(r.user_role.userId),
      to: r.role.id.through(r.user_role.roleId),
    }),
    /** 用户的登录会话 */
    sessions: r.many.session({
      from: r.user.id,
      to: r.session.userId,
    }),
  },
  post: {
    author: r.one.user({
      from: r.post.authorId,
      to: r.user.id,
    }),
  },
  role: {
    /** 拥有该角色的用户（多对多，经 user_role） */
    users: r.many.user({
      from: r.role.id.through(r.user_role.roleId),
      to: r.user.id.through(r.user_role.userId),
    }),
    /** 角色绑定的接口权限编号 */
    perms: r.many.role_permission({
      from: r.role.id,
      to: r.role_permission.roleId,
    }),
  },
}));
