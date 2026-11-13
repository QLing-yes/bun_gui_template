// 请求元信息插件：rid 生成
import { Elysia } from "elysia";

/** 请求上下文元信息：global derive 注入 rid，供 controller 日志与 error 钩子引用 */
export default new Elysia({ name: "app/plugins/request.plug" }).derive(
  "global",
  () => ({
    /** 每次请求的唯一标识 */
    rid: crypto.randomUUID(),
  }),
);
