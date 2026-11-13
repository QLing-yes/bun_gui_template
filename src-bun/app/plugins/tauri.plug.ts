// 桌面宿主安全插件：/offline 门控与宿主访问令牌校验
import { Elysia } from "elysia";
import * as $g from "@/app/common";
import { config as tauri_config } from "@/app/common/tauri_sidecar";
import { logger } from "@/app/lib/logger";

/** 桌面宿主安全：/offline 仅桌面本地模式可达，且需校验宿主启动时注入的访问令牌（plugin scope 覆盖 index 后续挂载的路由） */
export default new Elysia({ name: "app/plugins/tauri.plug" })
  /** 形态门控：/offline 属本机桌面服务专属能力，服务器实例（无令牌）访问一律 404 */
  .onBeforeHandle("plugin", ({ set, path }) => {
    if (tauri_config.token || !path.startsWith("/offline")) return;
    set.status = 404;
    return $g.error("Not Found");
  })
  /** 桌面本地服务模式校验访问令牌（含宿主启动/退出通知），拦截本机其他进程；开发模式（无令牌）全放行 */
  .onBeforeHandle("plugin", ({ request, set, path }) => {
    if (!tauri_config.token) return;
    if (request.headers.get("x-tauri-token") === tauri_config.token) return;
    logger.warn(`[auth] rejected ${request.method} ${path}`);
    set.status = 401;
    return $g.error("Unauthorized");
  });
