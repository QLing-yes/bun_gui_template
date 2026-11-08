// AI 对话客户端封装：useChat 传输层（地址与鉴权头统一取自 lib/backend）

import { DefaultChatTransport, type ChatTransport, type UIMessage } from "ai"

import { apiUrl, authHeaders } from "@/lib/backend"

/** 创建对话传输层：浏览器/服务器形态下令牌为空，authHeaders 自然不加头
 * @returns useChat 可用的传输实例 */
export function createChatTransport(): ChatTransport<UIMessage> {
  return new DefaultChatTransport({
    api: apiUrl("/api/chat"),
    // transport 仅消费函数本体，bun 端 fetch 类型含 preconnect 等附加成员，包装函数按本体断言
    fetch: (async (input, init) =>
      fetch(input, {
        ...init,
        headers: await authHeaders(init?.headers),
      })) as typeof globalThis.fetch,
  })
}
