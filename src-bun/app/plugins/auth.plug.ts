import { Elysia } from "elysia";
import { bearerToken, verifyAccessToken } from "@/app/lib/auth";

/** 鉴权插件：解析 access token；perm 校验由 perm 宏自身完成 */
export default new Elysia({ name: "app/plugins/auth.plug" })
  // 只验签不查库，未带 token 时为 null；需要用户状态的场景由后续步骤补查
  // global：覆盖所有后代路由（含 index 后续挂载的离线路由）
  .derive("global", async ({ request }) => {
    const token = bearerToken(request);
    return { authUser: token ? await verifyAccessToken(token) : null };
  });
