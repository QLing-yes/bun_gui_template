// AI 对话示例页：AI Elements 聊天原语 + useChat 流式对话（后端 /api/chat 转发 OpenAI 兼容接口）

import { useChat } from "@ai-sdk/react"
import type { UIMessage } from "ai"
import {
  ArrowUpIcon,
  BotIcon,
  LoaderCircleIcon,
  SquareIcon,
} from "lucide-react"
import { memo, useMemo, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { FILL_CLASS } from "@/components/layout/class-names"
import { PageCanvas } from "@/components/layout/page-canvas"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { StaggerReveal } from "@/components/stagger-reveal"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { Message, MessageContent } from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import { Trace, TraceIcon, TraceLine, TraceTitle } from "@/components/ui/trace"
import { createChatTransport } from "@/lib/chat"
import { cn } from "cn"

/** 对话消息流与输入条共用的定宽列（两侧内边距由各自补充） */
const CHAT_COLUMN_CLASS = "mx-auto w-full max-w-2xl"

/** 提取服务端错误的可读文案（优先 JSON error 字段）
 * @param message 原始错误文本 @returns 展示文本 */
function extractErrorText(message: string): string {
  try {
    const parsed = JSON.parse(message) as { error?: unknown }
    if (typeof parsed?.error === "string") return parsed.error
  } catch {
    /* 非 JSON 原样展示 */
  }
  return message
}

/** 拼接消息里的全部文本分片 @param message 消息 @param sep 分片分隔符 @returns 纯文本 */
function textOf(message: UIMessage, sep = ""): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join(sep)
}

/** 单条消息：用户右侧气泡纯文本，助手左侧 Markdown 排版；memo 隔离流式期整列表重渲染 */
const ChatMessage = memo(function ChatMessage({
  message,
}: {
  message: UIMessage
}) {
  if (message.role === "user") {
    return (
      <Message align="end">
        <MessageContent>
          <Bubble align="end" variant="muted">
            <BubbleContent>{textOf(message)}</BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
    )
  }

  return (
    <Message align="start">
      <MessageContent>
        <Bubble variant="ghost">
          <BubbleContent>
            {/* overflow-x-auto: 长表格/代码横向滚动，不撑破气泡 */}
            <div className="typeset overflow-x-auto">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {textOf(message, "\n\n")}
              </ReactMarkdown>
            </div>
          </BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  )
})

/** 输入区：Enter 发送、Shift+Enter 换行；生成中变为停止按钮 */
function PromptForm({
  isBusy,
  onSubmit,
  onStop,
}: {
  /** 是否正在请求/流式生成 */
  isBusy: boolean
  /** 发送消息 @param text 消息文本 */
  onSubmit: (text: string) => void
  /** 停止生成 */
  onStop: () => void
}) {
  const [prompt, setPrompt] = useState("")

  /** 发送：清空输入并提交非空文本 */
  const submit = () => {
    const text = prompt.trim()
    if (!text || isBusy) return
    setPrompt("")
    onSubmit(text)
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <InputGroup>
        <InputGroupTextarea
          rows={1}
          placeholder="输入消息，Enter 发送，Shift+Enter 换行"
          className="max-h-40 resize-none"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            // 输入法组合态的回车是"上屏"，不触发发送
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault()
              submit()
            }
          }}
        />
        <InputGroupAddon align="block-end">
          {isBusy ? (
            <InputGroupButton
              size="icon-sm"
              aria-label="停止生成"
              onClick={(e) => {
                e.preventDefault()
                onStop()
              }}
            >
              <SquareIcon className="size-4 shrink-0" />
            </InputGroupButton>
          ) : (
            <InputGroupButton
              size="icon-sm"
              type="submit"
              disabled={!prompt.trim()}
              aria-label="发送"
            >
              <ArrowUpIcon className="size-4 shrink-0" />
            </InputGroupButton>
          )}
        </InputGroupAddon>
      </InputGroup>
    </form>
  )
}

export function ChatPage() {
  const transport = useMemo(() => createChatTransport(), [])
  const { messages, sendMessage, status, stop, error } = useChat({ transport })

  /** 请求中（已提交或流式接收） */
  const isBusy = status === "submitted" || status === "streaming"

  return (
    <PageCanvas>
      <div className={cn(FILL_CLASS, "flex flex-col")}>
        {messages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-4 sm:p-6">
            <StaggerReveal>
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <BotIcon />
                  </EmptyMedia>
                  <EmptyTitle>有什么可以帮您？</EmptyTitle>
                  <EmptyDescription>
                    输入消息开始对话，回复经 Vercel AI SDK 流式传输
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </StaggerReveal>
          </div>
        ) : (
          <MessageScrollerProvider>
            <MessageScroller className="flex-1">
              <MessageScrollerViewport>
                <MessageScrollerContent
                  className={cn(CHAT_COLUMN_CLASS, "px-4 py-6 sm:px-6")}
                >
                  {messages.map((message) => (
                    <MessageScrollerItem
                      key={message.id}
                      messageId={message.id}
                      scrollAnchor={message.role === "user"}
                    >
                      <ChatMessage message={message} />
                    </MessageScrollerItem>
                  ))}
                  {/* 已提交未出字：思考中占位 */}
                  {status === "submitted" && (
                    <MessageScrollerItem messageId="thinking">
                      <Message>
                        <MessageContent>
                          <Trace>
                            <TraceLine status="running">
                              <TraceIcon>
                                <LoaderCircleIcon className="animate-spin" />
                              </TraceIcon>
                              <TraceTitle>思考中</TraceTitle>
                            </TraceLine>
                          </Trace>
                        </MessageContent>
                      </Message>
                    </MessageScrollerItem>
                  )}
                </MessageScrollerContent>
              </MessageScrollerViewport>
              <MessageScrollerButton />
            </MessageScroller>
          </MessageScrollerProvider>
        )}

        <div
          className={cn(
            CHAT_COLUMN_CLASS,
            "flex flex-col gap-2 px-4 pb-4 sm:px-6 sm:pb-6"
          )}
        >
          {error && (
            <StaggerReveal>
              <Alert variant="destructive">
                <AlertTitle>请求失败</AlertTitle>
                <AlertDescription>
                  {extractErrorText(error.message)}
                </AlertDescription>
              </Alert>
            </StaggerReveal>
          )}
          <PromptForm
            isBusy={isBusy}
            onSubmit={(text) => sendMessage({ text })}
            onStop={() => stop()}
          />
        </div>
      </div>
    </PageCanvas>
  )
}
