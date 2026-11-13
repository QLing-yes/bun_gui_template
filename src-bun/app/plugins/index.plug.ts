import { Elysia } from "elysia";
import { collectPermRoutes } from "@/app/common/no_global";
import { logger } from "@/app/lib/logger";
import plug_controller from "@/app/plugins/controller.plug";
import plug_error from "@/app/plugins/error.plug";
import plug_request from "@/app/plugins/request.plug";
import plug_tauri from "@/app/plugins/tauri.plug";
import routes from "@/runtime/generated/routes";

export const routes_ctrl = plug_controller.use(routes);

/** 检查权限编号是否唯一，不阻塞模块加载 */
collectPermRoutes().then(({ permRepeat }) => {
  if (permRepeat.size > 0) logger.error("[权限编号重复]", Object.fromEntries(permRepeat));
});

const app = new Elysia({ name: "app/plugins/index.plug" })
  // 按注册顺序：rid → 桌面安全 → 错误兜底 → 控制器路由
  .use(plug_request)
  .use(plug_tauri)
  .use(plug_error)
  // 必须 app.use(routes_ctrl)，否则类型推断链路就断
  .use(routes_ctrl);

export default app;
