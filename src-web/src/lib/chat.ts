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

/** AI 命名结果 @property projectTitle 项目名（未请求或无效为 null） @property conversationTitle 对话名（无效为 null） */
export type ChatTitles = {
  projectTitle: string | null
  conversationTitle: string | null
}

/** 请求 AI 命名：新建项目一次生项目名+对话名，项目内新对话只生对话名；失败静默回落 null，由调用方保留占位名
 * @param messages 对话全量消息 @param withProject 是否同时生成项目名 @returns 命名结果；请求失败为 null */
export async function requestTitle(
  messages: UIMessage[],
  withProject: boolean
): Promise<ChatTitles | null> {
  try {
    const res = await fetch(apiUrl("/api/title"), {
      method: "POST",
      headers: await authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ messages, withProject }),
    })
    if (!res.ok) {
      if (import.meta.env.DEV)
        console.warn("[title] http-fail", { status: res.status })
      return null
    }
    const data = (await res.json()) as {
      projectTitle?: unknown
      conversationTitle?: unknown
    }
    /** 收敛服务端字段：非空字符串才认 @param value 原始值 @returns 标题或 null */
    const pick = (value: unknown): string | null =>
      typeof value === "string" && value.trim() ? value.trim() : null
    return {
      projectTitle: pick(data.projectTitle),
      conversationTitle: pick(data.conversationTitle),
    }
  } catch (e) {
    if (import.meta.env.DEV) console.warn("[title] request-fail", e)
    return null
  }
}
