// 全局错误处理插件：统一错误日志与响应
import { Elysia, ElysiaError, ValidationError } from "elysia";
import * as $g from "@/app/common";
import { logger } from "@/app/lib/logger";

/** 全局错误兜底：记录日志并输出统一错误响应（global scope 覆盖所有后代路由） */
export default new Elysia({ name: "app/plugins/error.plug" }).onError(
  "global",
  ({ error, request, set, ...p }) => {
    const err = error instanceof Error ? error : new Error(String(error));
    const errCode = error instanceof ElysiaError ? error.code : err.name;
    // 人性化验证器错误信息（只取第一个数据验证错误信息，已格式化处理）
    if (error instanceof ValidationError) {
      const property = error.all[0].path.replace(/^\//, "");
      err.message = `[${error.type}] ${property} : ${err.message}`;
    }
    // 记录错误日志（rid 仅在 handler 抛错时可用；校验失败 derive 未执行，rid 为 undefined）
    logger.error(`${request.method} ${p.route || p.path}`, {
      rid: p.rid,
      code: errCode,
      msg: err.message,
      stack: err.stack,
    });
    // 统一错误响应
    set.headers["content-type"] = "application/json";
    return $g.error(err.message);
  },
);
