// AI 命名：首条完整回复后按对话内容生成名称——新建项目一次返回项目名+对话名（withProject），项目内新对话只返回对话名

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { convertToModelMessages, generateText, type UIMessage } from "ai";
import { t } from "elysia";

/** 单名指令：项目内新对话，只生成对话名 */
const SINGLE_INSTRUCTION =
  "根据这段对话生成一个简短的中文对话标题，不超过 12 个字；只输出标题本身，不要引号、标点或解释。若对话内容过少（如纯问候）无法归纳有意义的标题，只输出 NONE。";

/** 双名指令：新建项目，项目名概括整体方向、对话名指向本次话题，严格 JSON 输出 */
const DUAL_INSTRUCTION =
  '根据这段对话生成两个中文名称：项目名（概括整体方向，不超过 10 个字）与对话名（指向本次具体话题，不超过 12 个字）。只输出 JSON：{"projectTitle":"项目名","conversationTitle":"对话名"}，不要输出其他文字。若对话内容过少（如纯问候）无法归纳有意义的标题，两个字段都填 NONE。';

/** 兜底标题的可信上限（字）：模型吐解释话术时整段文本会超长——宁可不落名，也不把话术截断当标题 */
const FALLBACK_MAX = 16;

/** 收敛标题文本：去首尾引号、限长、识别 NONE @param value 原始值 @returns 可用标题；无效为 null */
function cleanTitle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const title = value.trim().replace(/^["'“”]+|["'“”]+$/g, "");
  if (!title || /^none$/i.test(title)) return null;
  return title.slice(0, 24);
}

export default $g.ctrl((app) =>
  app.post(
    "title",
    {
      body: t.Object({
        messages: t.Array(t.Any()),
        withProject: t.Optional(t.Boolean()),
      }),
    },
    async ({ body, request }) => {
      const baseURL = Bun.env.AI_BASE_URL;
      const modelId = Bun.env.AI_MODEL;
      // env 未配置：返回明确错误，前端回落占位名
      if (!baseURL || !modelId) {
        return Response.json(
          { error: "未配置 AI_BASE_URL / AI_MODEL（根目录 .env）" },
          { status: 500 },
        );
      }

      /** OpenAI 兼容 provider（与 chat 路由同一配置源） */
      const provider = createOpenAICompatible({
        name: "custom",
        baseURL,
        apiKey: Bun.env.AI_API_KEY ?? "",
      });

      const withProject = body.withProject === true;
      // v7 起 system 消息不进 messages：指令走 instructions 专用参数
      const result = await generateText({
        model: provider(modelId),
        instructions: withProject ? DUAL_INSTRUCTION : SINGLE_INSTRUCTION,
        messages: await convertToModelMessages(body.messages as UIMessage[]),
        abortSignal: request.signal,
        maxRetries: 1,
      });

      const raw = result.text.trim();
      if (withProject) {
        // 宽容解析：模型可能包代码栅栏或附带说明，取第一段花括号 JSON
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            const parsed = JSON.parse(match[0]) as {
              projectTitle?: unknown;
              conversationTitle?: unknown;
            };
            const conversationTitle = cleanTitle(parsed.conversationTitle);
            const projectTitle = cleanTitle(parsed.projectTitle);
            if (conversationTitle && projectTitle) {
              return Response.json({ projectTitle, conversationTitle });
            }
          } catch {
            /* JSON 坏值走下方降级 */
          }
        }
        // 降级：仅当整段文本本身就是一条短标题时才同值兜底；NONE/解释话术一律不落名（保持占位，后续轮次可再试）
        const fallback = raw.length <= FALLBACK_MAX ? cleanTitle(raw) : null;
        if (!fallback) return Response.json({});
        return Response.json({
          projectTitle: fallback,
          conversationTitle: fallback,
        });
      }

      const conversationTitle =
        raw.length <= FALLBACK_MAX ? cleanTitle(raw) : null;
      if (!conversationTitle) return Response.json({});
      return Response.json({ conversationTitle });
    },
  ),
);