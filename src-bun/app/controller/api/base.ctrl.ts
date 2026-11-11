import { collectPermRoutes } from "@/app/common/no_global";
import { t } from "elysia";

export default (app: Ctrl) =>
    app
        .post(
            "/ready",
            {
                title: "本服务是否就绪",
                res: t.String()
            },
            () => $g.success("yes")
        )
        .post(
            "/all_perm",
            {
                title: "获取所有权限路由",
                res: t.Array(t.Number())
            },
            async () => {
                const { permRoutes } = await collectPermRoutes();
                /** 权限编号 + 路由签名，Map 需展开后遍历 */
                const permList = [...permRoutes].map(
                    ([code]) => code,
                );
                return $g.success(permList)
            })
