// 这里放一些不能进入全局“$g”的公共代码（因为加入到 “$g" 会导致循环引用或未定义报错）

import type { PublicRoute } from "elysia/types";

/** OpenAPI 扩展字段：接口权限编号 */
export const PERM_CODE_KEY = "x-perm-code" as const;

/** 权限路由扫描结果 */
export interface PermRouteScan {
  /** 权限编号 → 路由签名列表（长度 >1 即编号重复） */
  permRoutes: Map<number, string[]>;
  /** 重复的权限编号 → 路由签名列表 */
  permRepeat: Map<number, string[]>;
}

/**
 * 获取已注册路由的权限编号
 * @param force 丢弃缓存获取最新的
 */
export const collectPermRoutes = (() => {
  /** 扫描缓存：路由在进程内固定，只编译/遍历一次 */
  let cache: Promise<PermRouteScan> | undefined;

  /** 单次遍历建立编号 → 路由列表；延迟导入 routes_ctrl 避免与 index.plug 静态循环 */
  const scan = async (): Promise<PermRouteScan> => {
    const { routes_ctrl } = await import("@/app/plugins/index.plug");
    const routes: PublicRoute[] = routes_ctrl.routes;
    const permRoutes = new Map<number, string[]>();
    const permRepeat = new Map<number, string[]>();

    for (const { method, path, hooks } of routes) {
      const code = hooks?.detail?.[PERM_CODE_KEY];
      if (typeof code !== "number") continue;
      const route = `${method} ${path}`;
      const list = permRoutes.get(code);
      if (!list) {
        permRoutes.set(code, [route]);
        continue;
      }
      // 同一签名重复注册不算编号冲突
      if (list.includes(route)) continue;
      list.push(route);
      permRepeat.set(code, list);
    }

    return { permRoutes, permRepeat };
  };

  return (force = false): Promise<PermRouteScan> => {
    if (force) cache = undefined;
    cache ??= scan().catch((error) => {
      // 失败不缓存，允许下次重试
      cache = undefined;
      throw error;
    });
    return cache;
  };
})();
