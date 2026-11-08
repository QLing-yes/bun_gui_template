import { treaty } from "@elysia/eden"
import type { APP } from "@bun/app/index"

import { apiUrl, treatyRequest } from "@/lib/backend"

/** Eden treaty 客户端（全局单例，端到端类型来自 src-bun 生成的类型树）
 * 响应为统一信封 { msg, code, data }：code===1 成功；HTTP/网络失败走 error 分支或抛异常
 * 地址与 sidecar 鉴权头统一取自 lib/backend（形态判据不在本文件）
 */
export const client = treaty<APP>(apiUrl(""), { onRequest: treatyRequest })
