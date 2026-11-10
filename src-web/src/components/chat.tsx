// AI 聊天组件：官方聊天原语 + useChat 流式对话，完全由 session 对象驱动（零路由、零存储、零地址感知）
// 新建项目/项目内新对话/续聊共用本组件，差异全部在调用方构造的 session 数据里
// 页面级资产（PageCanvas 背景）归调用方，本组件只铺满父容器

import { useChat } from "@ai-sdk/react"
import type { ChatStatus, UIMessage } from "ai"
import { memo, useEffect, useMemo, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { AppIcon } from "@/components/icons"
import { FILL_CLASS } from "@/components/layout/class-names"
import { StaggerReveal } from "@/components/stagger-reveal"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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

/** 聊天会话：组件唯一入口参数对象 @property messages 初始消息（续聊=已存全量，草稿=空数组） @property onComplete 回复完整完成回调（停止/断线/报错不触发），落库/命名/导航由调用方决定 @property onStatusChange 流式状态变化回调（供调用方做生成中指示等） @property invalidated 对话被外部删除：调用方保持挂载并置真，组件停掉孤儿流 */
export type ChatSession = {
  messages: UIMessage[]
  onComplete: (messages: UIMessage[]) => void
  onStatusChange?: (status: ChatStatus) => void
  invalidated?: boolean
}

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
              <AppIcon name="square" size={16} />
            </InputGroupButton>
          ) : (
            <InputGroupButton
              size="icon-sm"
              type="submit"
              disabled={!prompt.trim()}
              aria-label="发送"
            >
              <AppIcon name="send" size={16} />
            </InputGroupButton>
          )}
        </InputGroupAddon>
      </InputGroup>
    </form>
  )
}

/** AI 聊天组件 @param session 会话对象（唯一入口）：初始消息 + 完整完成回调 */
export function Chat({ session }: { session: ChatSession }) {
  /** useChat 可能持有首次渲染的 onFinish 闭包：回调经 ref 取最新 session */
  const sessionRef = useRef(session)
  useEffect(() => {
    sessionRef.current = session
  })

  const transport = useMemo(() => createChatTransport(), [])
  const { messages, sendMessage, status, stop, error, setMessages } = useChat({
    transport,
    messages: session.messages,
    onFinish: ({ messages: all, isAbort, isDisconnect, isError }) => {
      // 停止/断线/报错不算成功：不通知调用方，等下一次完整回复整份交出
      if (isAbort || isDisconnect || isError) return
      sessionRef.current.onComplete(all)
    },
  })

  /** 已同步过的初始消息水位：只跟随外部真源变化，不回抹本页未落库的半截回复 */
  const syncedRef = useRef(session.messages)
  // 保活槽跟随：冻结期间同对话被别槽/跨窗口更新时，回就绪后对齐一次（流式中不动）
  useEffect(() => {
    if (session.messages === syncedRef.current) return
    if (status === "submitted" || status === "streaming") return
    syncedRef.current = session.messages
    setMessages(session.messages)
  }, [session.messages, status, setMessages])

  /** 请求中（已提交或流式接收） */
  const isBusy = status === "submitted" || status === "streaming"

  // 对话被外部删除（调用方置 invalidated 并保持挂载）：停孤儿流，避免白烧 token
  useEffect(() => {
    if (session.invalidated && isBusy) stop()
  }, [session.invalidated, isBusy, stop])

  // 状态变化通知调用方（经 ref 取最新 session）：生成中指示等由调用方自决
  useEffect(() => {
    sessionRef.current.onStatusChange?.(status)
  }, [status])

  return (
    <div className={cn(FILL_CLASS, "flex flex-col")}>
      {messages.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-4 sm:p-6">
          <StaggerReveal>
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <AppIcon name="bot" size={24} />
                </EmptyMedia>
                <EmptyTitle>有什么可以帮您？</EmptyTitle>
                <EmptyDescription>
                  输入消息开始对话，AI 回复实时流式呈现
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
                              <AppIcon
                                name="loadingV2"
                                interaction="loop"
                                size={16}
                              />
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
  )
}