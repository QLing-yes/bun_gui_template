import type controller from "@/app/plugins/controller.plug";
import type { ResType } from "./schemaDerive";

export { logger } from "@/app/lib/logger";
export { client as redis } from "@/app/lib/redis";
export { db as mysql } from "@/app/model/mysql/db";
export { db as pg } from "@/app/model/postgresql/db";
export { db as sqlite } from "@/app/model/sqlite/db";
export { ResSchemaFun as res } from "./schemaDerive";

/** 控制器工厂 */
export const ctrl = <T>(fun: (app: typeof controller) => T) => fun;

/** 成功响应 */
export function success<T>(data: T, msg = ""): ResType<T> {
  return { msg, code: 1, data };
}

/** 错误响应 */
export function error<T = null>(
  msg = "",
  code = 0,
  data: T = null as T,
): ResType<T> {
  return { msg, code, data };
}
