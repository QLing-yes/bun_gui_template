// controller路由范围内的插件导入到这里注册
import { Elysia } from "elysia";
import { logger } from "@/app/lib/logger";
import plug_auth from "@/app/plugins/auth.plug";
import plug_macro from "@/app/plugins/macro.plug";
import plug_schemas from "@/app/plugins/schemas.plug";

/** 控制器插件：注册 schemas / macro / auth 三个路由级插件与请求日志 */
export default new Elysia({ name: "app/plugins/controller.plug" })
  .use(plug_schemas)
  .use(plug_macro)
  /** 统一请求日志（local scope：仅作用于 controller 及其子孙路由，能读到 request 插件 global derive 注入的 rid） */
  .onBeforeHandle((p) => {
    const mate = Object.fromEntries(
      Object.entries({
        rid: p.rid,
        params: p.params,
        query: p.query,
        body: p.body,
        cookie: p.cookie,
      })
        /** 剔除空属性，避免日志出现无意义的空对象 */
        .filter(
          ([, v]) => !v || typeof v !== "object" || Object.keys(v).length > 0,
        ),
    );
    logger.info(`[request] ${p.request.method} ${p.route || p.path}`, mate);
  })
  /** 登录态与接口权限校验（路由未声明 perm 编号即公开） */
  .use(plug_auth);
