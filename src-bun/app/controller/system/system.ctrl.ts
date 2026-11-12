import { t } from "elysia";
import { collectPermRoutes } from "@/app/common/no_global";

export default (app: Ctrl) =>
  app
    .post(
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
        /** 权限编号 → 路由签名 */
        res: t.Record(t.Number(), t.String()),
      },
      async () => {
        const { permRoutes } = await collectPermRoutes();
        /** 权限编号 → 路由签名（重复编号以 " | " 连接展示） */
        const perm_route = {} as Record<number, string>;
        for (const [code, routes] of permRoutes) {
          perm_route[code] = routes.join(" | ");
        }
        return $g.success(perm_route);
      },
    );
