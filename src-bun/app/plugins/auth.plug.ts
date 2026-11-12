import { Elysia } from "elysia";
import * as $c from "@/app/common";
import {
  bearerToken,
  canAccess,
  permCodeOf,
  resolveAuthContext,
  verifyAccessToken,
} from "@/app/lib/auth";

/** 鉴权插件：解析 access token + 按路由声明的权限编号校验 */
export default new Elysia({ name: String($g.counter.n) })
  // 只验签不查库，未带 token 时为 null；需要用户状态的场景由后续步骤补查
  // global：让 controller 层所有处理器都能拿到 authUser（含后续挂载的路由）
  .derive("global", async ({ request }) => {
    const token = bearerToken(request);
    return { authUser: token ? await verifyAccessToken(token) : null };
  })
  // 路由未声明 perm 编号视为公开接口；声明了则要求登录 + 命中权限
  .onBeforeHandle("global", async ({ authUser, request, path, set }) => {
    const permCode = await permCodeOf(request.method, path);
    if (permCode === undefined) return;
    if (!authUser) {
      set.status = 401;
      return $c.error("未登录或登录凭证已过期");
    }
    const ctx = await resolveAuthContext(authUser.userId);
    if (!ctx) {
      set.status = 401;
      return $c.error("账号不存在或已被禁用");
    }
    if (!canAccess(ctx, permCode)) {
      set.status = 403;
      return $c.error("没有访问该接口的权限");
    }
  });
