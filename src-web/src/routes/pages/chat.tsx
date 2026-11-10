// AI 对话页适配层：地址 → ChatSession 数据，聊天本体在 components/chat（三种地址共用同一组件、不同数据驱动）
// 地址三态：/ 或 ?draft=新建项目草稿、/chat?project=&draft=项目内新对话草稿、/chat?id=续聊已存对话
// 草稿首条 AI 回复完整完成才落库（停止/断线/报错不算），随后 replace 到 /chat?id= 并请求 AI 命名

import type { ChatStatus, UIMessage } from "ai"
import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router"

import { Chat } from "@/components/chat"
import type { ChatSession } from "@/components/chat"
import { AppIcon } from "@/components/icons"
import { FILL_CLASS } from "@/components/layout/class-names"
import { PageCanvas } from "@/components/layout/page-canvas"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { requestTitle } from "@/lib/chat"
import { useChatDraftsStore } from "@/store/chat-drafts"
import { useChatRunsStore } from "@/store/chat-runs"
import {
  CONVERSATION_PLACEHOLDER,
  PROJECT_PLACEHOLDER,
  useProjectsStore,
} from "@/store/projects"
import { cn } from "cn"

/** 草稿空消息常量（稳定引用） */
const EMPTY_MESSAGES: UIMessage[] = []

/** AI 命名请求 + 占位守卫落库：只覆盖仍为占位名的行（避免盖掉用户手动改名），可反复调用直到落名
 * @param all 全量消息（命名素材） @param ownerId 归属项目 id @param cid 对话 id @param wantProject 是否需要项目名 @param wantConv 是否需要对话名 */
function applyTitles(
  all: UIMessage[],
  ownerId: string,
  cid: string,
  wantProject: boolean,
  wantConv: boolean
) {
  if (!wantProject && !wantConv) return
  void requestTitle(all, wantProject).then((titles) => {
    if (!titles) return
    const latest = useProjectsStore.getState()
    const conv = latest.conversations.find((c) => c.id === cid)
    if (wantConv && titles.conversationTitle && conv?.name === CONVERSATION_PLACEHOLDER)
      latest.renameConversation(cid, titles.conversationTitle)
    const proj = latest.projects.find((p) => p.id === ownerId)
    if (wantProject && titles.projectTitle && proj?.name === PROJECT_PLACEHOLDER)
      latest.renameProject(ownerId, titles.projectTitle)
    if (import.meta.env.DEV) {
      console.debug("[title] apply", {
        convRenamed:
          wantConv && !!titles.conversationTitle &&
          conv?.name === CONVERSATION_PLACEHOLDER,
        projRenamed:
          wantProject && !!titles.projectTitle &&
          proj?.name === PROJECT_PLACEHOLDER,
        convName: conv?.name,
        projName: proj?.name,
      })
    }
  })
}

export function ChatPage() {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const params = new URLSearchParams(search)
  /** 地址里的对话 id（续聊）；draft 参数=草稿登记处标识（落库后清登记） */
  const conversationId = params.get("id")
  /** 地址里的项目 id（项目内新对话草稿） */
  const projectId = params.get("project")
  /** 地址里的草稿标识（落库后清登记） */
  const draftId = params.get("draft")
  const conversation = useProjectsStore((s) =>
    conversationId
      ? s.conversations.find((c) => c.id === conversationId)
      : undefined
  )
  /** 草稿首次落库后记住对话 id：本槽被保活重访时后续回复仍写回同一对话 */
  const [savedId, setSavedId] = useState<string | null>(null)

  // 裸地址（直达/刷新）收敛到登记草稿：保证草稿槽恒带 draft 参数且与登记处一致，复用不会命中已落库旧槽
  useEffect(() => {
    if (conversationId || draftId) return
    const drafts = useChatDraftsStore.getState()
    navigate(drafts.openDraft(projectId ?? "new", projectId ?? undefined), {
      replace: true,
    })
  }, [conversationId, draftId, projectId, navigate])

  /** 本槽地址：生成态登记键（冻结槽各自上报、互不覆盖） */
  const slotKey = pathname + search

  /** 流式状态 → 生成态登记：submitted/streaming 才登记（对话 id 优先，草稿期记 draft id），其余清除 */
  const handleStatus = (status: ChatStatus) => {
    const id = conversationId ?? savedId ?? draftId
    useChatRunsStore
      .getState()
      .setRun(
        slotKey,
        id && (status === "submitted" || status === "streaming") ? id : null
      )
  }

  // 卸载或地址语义变化清掉本槽生成态标记：流中断/槽裁剪后徽标不残留
  useEffect(() => {
    return () => useChatRunsStore.getState().setRun(slotKey, null)
  }, [slotKey, conversationId, savedId])
  /** 回复完整完成：续聊写回原对话；草稿建项目/对话并请求 AI 命名（组件经最新 session 回调，闭包即当前地址语义） */
  const handleComplete = (all: UIMessage[]) => {
    const id = conversationId ?? savedId
    const store = useProjectsStore.getState()
    if (id) {
      store.setMessages(id, all)
      // 迟到命名：首轮内容太少没起出名（仍是占位）时，之后每轮完成再试一次，落名后自然停
      const conv = store.conversations.find((c) => c.id === id)
      if (conv)
        applyTitles(
          all,
          conv.projectId,
          id,
          store.projects.find((p) => p.id === conv.projectId)?.name ===
            PROJECT_PLACEHOLDER,
          conv.name === CONVERSATION_PLACEHOLDER
        )
      return
    }
    // 首条完整回复：建对话；项目参数缺失或已删除时连项目一起建
    const owner =
      projectId && store.projects.some((p) => p.id === projectId)
        ? projectId
        : store.createProject(PROJECT_PLACEHOLDER)
    const projectCreated = owner !== projectId
    const cid = store.addConversation(owner, CONVERSATION_PLACEHOLDER, all)
    setSavedId(cid)
    // 草稿已落库成对话：清登记，下次新建开新草稿
    if (draftId) useChatDraftsStore.getState().clearDraft(draftId)
    // 流式期间用户可能已切走（本槽被冻结）：只落库不劫持当前地址，槽的 Location 是冻结值、真实地址看 hash
    if (window.location.hash.replace(/^#/, "") === pathname + search) {
      navigate(`/chat?id=${cid}`, { replace: true })
    }
    // AI 命名：新建项目一次生项目名+对话名，项目内新对话只生对话名；仅覆盖仍为占位名的行，避免盖掉命名期间用户的手动重命名
    applyTitles(all, owner, cid, projectCreated, true)
  }

  /** 续聊对话被外部删除：空状态照显，但 Chat 保持挂载接收停流指令（孤儿流不白烧） */
  const invalidated = Boolean(conversationId && !conversation)

  // 同一组件、不同数据：续聊=已存消息，草稿=空消息；归属差异全在 handleComplete 闭包
  const session: ChatSession = {
    messages: conversation?.messages ?? EMPTY_MESSAGES,
    onComplete: handleComplete,
    onStatusChange: handleStatus,
    invalidated,
  }
  return (
    <PageCanvas>
      {invalidated && (
        <div className={cn(FILL_CLASS, "flex items-center justify-center p-4")}>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <AppIcon name="bot" size={24} />
              </EmptyMedia>
              <EmptyTitle>对话不存在或已删除</EmptyTitle>
            </EmptyHeader>
            <Button
              onClick={() =>
                navigate(useChatDraftsStore.getState().openDraft("new"))
              }
            >
              新建项目
            </Button>
          </Empty>
        </div>
      )}
      <div className={cn(invalidated && "hidden")}>
        <Chat session={session} />
      </div>
    </PageCanvas>
  )
}
