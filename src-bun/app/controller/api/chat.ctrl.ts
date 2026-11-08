// AI 对话示例：转发到 OpenAI 兼容接口（根目录 .env 配置），流式返回 UI 消息流

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { t } from "elysia";

export default $g.ctrl((app) =>
  app.post(
    "chat",
    {
      body: t.Object({ messages: t.Array(t.Any()) }),
    },
    async ({ body, request }) => {
      const baseURL = Bun.env.AI_BASE_URL;
      const modelId = Bun.env.AI_MODEL;
      // env 未配置：返回明确错误，前端 Alert 直接可见
      if (!baseURL || !modelId) {
        return Response.json(
          { error: "未配置 AI_BASE_URL / AI_MODEL（根目录 .env）" },
          { status: 500 },
        );
      }

      /** OpenAI 兼容 provider（Ollama/DeepSeek/任意自建网关均可） */
      const provider = createOpenAICompatible({
        name: "custom",
        baseURL,
        apiKey: Bun.env.AI_API_KEY ?? "",
      });

      const result = streamText({
        model: provider(modelId),
        messages: await convertToModelMessages(body.messages as UIMessage[]),
        abortSignal: request.signal,
        // 本地/侧car 场景服务不可达时快速失败，不让用户等满重试周期
        maxRetries: 1,
      });

      return createUIMessageStreamResponse({
        stream: toUIMessageStream({
          stream: result.stream,
          onError: (e) => (e instanceof Error ? e.message : String(e)),
        }),
      });
    },
  ),
);
