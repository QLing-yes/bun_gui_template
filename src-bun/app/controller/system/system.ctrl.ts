import { t } from "elysia";
import { collectPermRoutes } from "@/app/common/no_global";

export default (app: Ctrl) =>
  app
    .get(
      "/ready",
      {
        title: "本服务是否就绪",
        res: t.String(),
      },
      () => $g.success("yes"),
    )
    .post(
      "/all_perm",
      {
        title: "获取所有权限路由列表",
        perm: 11001,
        res: t.Object({
          /** 权限编号 → 路由签名列表 */
          permRoutes: t.Record(t.String(), t.Array(t.String())),
          /** 重复的权限编号 → 路由签名列表 */
          permRepeat: t.Record(t.String(), t.Array(t.String())),
        }),
      },
      async () => {
        const { permRoutes, permRepeat } = await collectPermRoutes();
        /** Map 无法被 JSON 序列化，统一转成普通对象 */
        return $g.success({
          /** 权限编号 → 路由签名列表 */
          permRoutes: Object.fromEntries(permRoutes),
          /** 重复的权限编号 → 路由签名列表 */
          permRepeat: Object.fromEntries(permRepeat),
        });
      },
    );
