import { Elysia } from "elysia";
import type { TSchema } from "elysia/type";
import * as $g from "@/app/common";
import { PERM_CODE_KEY } from "@/app/common/no_global";
import * as Schema from "@/app/common/schemaDerive";
import {
  type AccessPayload,
  canAccess,
  resolveAuthContext,
} from "@/app/lib/auth";

/** perm 宏校验所需的最小上下文 */
export interface PermContext {
  /** 当前登录用户载荷，由 auth 插件的全局 derive 注入；未登录为 null */
  authUser: AccessPayload | null;
  /** 响应状态写入句柄 */
  set: { status: number };
}

export default new Elysia({ name: "app/plugins/macro.plug" }).macro({
  /** 标准响应宏插件 - 统一返回格式与校验 */
  res<T extends TSchema>(payload?: T) {
    return {
      response: Schema.ResSchemaFun(payload),
    };
  },
  /**
   * 接口权限编号：写入路由元数据与 OpenAPI 文档
   * 同时承担权限判定（闭包 code + 用户权限缓存）
   * @param code 全局唯一的权限编号
   */
  perm(code: number) {
    return {
      detail: { [PERM_CODE_KEY]: code },
      /**
       * 路由级 beforeHandle：执行在 authUser 的全局 derive 之后，
       * 此时能读到该用户的权限缓存
       */
      beforeHandle: async ({ authUser, set }: PermContext) => {
        if (!authUser) {
          set.status = 401;
          return $g.error("未登录或登录凭证已过期");
        }
        const ctx = await resolveAuthContext(authUser.userId);
        if (!ctx) {
          set.status = 401;
          return $g.error("账号不存在或已被禁用");
        }
        if (!canAccess(ctx, code)) {
          set.status = 403;
          return $g.error("没有访问该接口的权限");
        }
      },
    };
  },
  /**
   * 接口标题：写入路由元数据与 OpenAPI 文档
   * @param summary 接口标题
   */
  title(summary: string) {
    return {
      detail: {
        summary,
      },
    };
  },
  /**
   * 接口描述：写入路由元数据与 OpenAPI 文档
   * @param description 接口描述
   */
  desc(description: string) {
    return {
      detail: {
        description,
      },
    };
  },
});
