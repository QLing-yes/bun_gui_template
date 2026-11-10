// 侧栏项目分区：顶部导航之下、区域独立滚动；图标折叠态收成一枚图标，悬停右侧浮出项目列表
// 项目行＝染色图标 + 名称（点击展开对话子列表）+ 右侧「新对话/更多」按钮；右键与更多菜单同为重命名/删除
// 彩色图标是数据驱动色（id 哈希定色相、色调恒定），不属于主题令牌体系

import { useState } from "react"
import type { ReactNode } from "react"
import { useLocation, useNavigate } from "react-router"

import { AppIcon } from "@/components/icons"
import type { AppIconName } from "@/components/icons"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { OVERLAY_CLOSE_MS } from "@/lib/motion"
import { useChatDraftsStore } from "@/store/chat-drafts"
import { isRunning, useChatRunsStore } from "@/store/chat-runs"
import { useProjectsStore } from "@/store/projects"
import type { ChatConversation, ChatProject } from "@/store/projects"
import { cn } from "cn"

/** 行菜单动作表：右键菜单与更多菜单共用同一份数据 @param onRename 重命名回调 @param onDelete 删除回调 @returns 动作清单 */
function rowActions(
  onRename: () => void,
  onDelete: () => void
): {
  label: string
  icon: AppIconName
  onClick: () => void
  destructive: boolean
}[] {
  return [
    { label: "重命名", icon: "edit2", onClick: onRename, destructive: false },
    { label: "删除", icon: "trash", onClick: onDelete, destructive: true },
  ]
}

/** 项目图标色：id 哈希定色相，饱和度/亮度恒定保证色调一致 @param id 项目 id @returns oklch 颜色值 */
function projectColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0
  return `oklch(0.62 0.14 ${Math.abs(hash) % 360})`
}

/** 侧栏导航：移动端先收抽屉再导航，桌面直接走 @returns 导航函数 */
function useSidebarNavigate(): (to: string) => void {
  const navigate = useNavigate()
  const { isMobile, setOpenMobile } = useSidebar()
  return (to) => {
    if (!isMobile) {
      navigate(to)
      return
    }
    setOpenMobile(false)
    window.setTimeout(() => navigate(to), OVERLAY_CLOSE_MS)
  }
}

/** 内联重命名输入：Enter/失焦提交、Esc 取消 @param defaultValue 现名 @param onCommit 提交新名 @param onCancel 取消 */
function RenameInput({
  defaultValue,
  onCommit,
  onCancel,
}: {
  defaultValue: string
  onCommit: (name: string) => void
  onCancel: () => void
}) {
  return (
    <Input
      autoFocus
      defaultValue={defaultValue}
      className="h-7 text-sm"
      onFocus={(e) => e.target.select()}
      onKeyDown={(e) => {
        if (e.key === "Enter") onCommit(e.currentTarget.value)
        if (e.key === "Escape") onCancel()
      }}
      onBlur={(e) => onCommit(e.target.value)}
    />
  )
}

/** 更多菜单触发按钮（对话行内小号 ghost）：触屏恒显，桌面悬停/聚焦才现 @param children 图标 @param label 无障碍名 */
function MoreTrigger({ children, label }: { children: ReactNode; label: string }) {
  return (
    <DropdownMenuTrigger
      render={
        <Button
          variant="ghost"
          aria-label={label}
          className="size-5 shrink-0 cursor-pointer p-0 md:opacity-0 md:group-hover/menu-sub-item:opacity-100 md:group-focus-within/menu-sub-item:opacity-100"
        />
      }
    >
      {children}
    </DropdownMenuTrigger>
  )
}

/** 对话行：链接 + 更多/右键菜单（重命名/删除） */
function ConversationRow({
  conversation,
  active,
  renaming,
  onNavigate,
  onRename,
  onRenameEnd,
  onDelete,
}: {
  /** 对话数据 */
  conversation: ChatConversation
  /** 是否当前地址的对话 */
  active: boolean
  /** 是否正在重命名 */
  renaming: boolean
  /** 导航 @param to 目标地址 */
  onNavigate: (to: string) => void
  /** 开始重命名 */
  onRename: () => void
  /** 结束重命名（提交或取消后收输入框） */
  onRenameEnd: () => void
  /** 请求删除（弹确认） */
  onDelete: () => void
}) {
  const renameConversation = useProjectsStore((s) => s.renameConversation)
  /** 该对话是否在任何槽生成中（含冻结槽） */
  const running = useChatRunsStore((s) => isRunning(s.runs, conversation.id))
  const to = `/chat?id=${conversation.id}`
  const actions = rowActions(onRename, onDelete)

  if (renaming) {
    return (
      <SidebarMenuSubItem>
        <RenameInput
          defaultValue={conversation.name}
          onCommit={(name) => {
            const trimmed = name.trim()
            if (trimmed) renameConversation(conversation.id, trimmed)
            onRenameEnd()
          }}
          onCancel={onRenameEnd}
        />
      </SidebarMenuSubItem>
    )
  }

  return (
    <SidebarMenuSubItem className="flex items-center gap-0.5">
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <SidebarMenuSubButton
              render={
                <button
                  type="button"
                  className="cursor-pointer"
                  aria-current={active ? "page" : undefined}
                  onClick={() => onNavigate(to)}
                />
              }
              isActive={active}
              className="min-w-0 flex-1"
            />
          }
        >
          <span className="truncate" title={conversation.name}>
            {conversation.name}
          </span>
          {running && (
            <AppIcon
              name="loadingV2"
              interaction="loop"
              size={14}
              className="text-muted-foreground"
              aria-label="生成中"
            />
          )}
        </ContextMenuTrigger>
        <ContextMenuContent>
          {actions.map((a) => (
            <ContextMenuItem
              key={a.label}
              variant={a.destructive ? "destructive" : undefined}
              onClick={a.onClick}
            >
              <AppIcon name={a.icon} size={16} />
              {a.label}
            </ContextMenuItem>
          ))}
        </ContextMenuContent>
      </ContextMenu>
      <DropdownMenu>
        <MoreTrigger label="对话操作">
          <AppIcon name="moreHorizontal" size={16} />
        </MoreTrigger>
        <DropdownMenuContent side="right" align="start">
          {actions.map((a) => (
            <DropdownMenuItem
              key={a.label}
              variant={a.destructive ? "destructive" : undefined}
              onClick={a.onClick}
            >
              <AppIcon name={a.icon} size={16} />
              {a.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuSubItem>
  )
}

/** 项目行：染色图标 + 名称展开对话子列表 + 新对话/更多按钮 + 右键菜单 */
function ProjectRow({
  project,
  conversations,
  expanded,
  activeId,
  renamingId,
  onToggle,
  onNavigate,
  onRename,
  onRenameEnd,
  onDelete,
  onRenameConversation,
  onDeleteConversation,
}: {
  /** 项目数据 */
  project: ChatProject
  /** 该项目下的对话（创建顺序） */
  conversations: ChatConversation[]
  /** 子列表是否展开 */
  expanded: boolean
  /** 当前地址的对话 id */
  activeId: string | null
  /** 正在重命名的行 id（项目或对话） */
  renamingId: string | null
  /** 展开/收起 */
  onToggle: () => void
  /** 导航 */
  onNavigate: (to: string) => void
  /** 开始重命名本项目 */
  onRename: () => void
  /** 结束重命名（提交或取消后收输入框） */
  onRenameEnd: () => void
  /** 请求删除本项目 */
  onDelete: () => void
  /** 开始重命名对话 @param id 对话 id */
  onRenameConversation: (id: string) => void
  /** 请求删除对话 @param id 对话 id */
  onDeleteConversation: (id: string) => void
}) {
  const renameProject = useProjectsStore((s) => s.renameProject)
  /** 旗下任一对话生成中即在项目行提示（收起态也可见） */
  const running = useChatRunsStore((s) =>
    conversations.some((c) => isRunning(s.runs, c.id))
  )
  /** 本项目草稿（若有）：草稿期流式也计入项目行指示 */
  const draft = useChatDraftsStore((s) => s.drafts[project.id])
  const draftRunning = useChatRunsStore((s) =>
    draft ? isRunning(s.runs, draft.id) : false
  )
  const actions = rowActions(onRename, onDelete)

  if (renamingId === project.id) {
    return (
      <SidebarMenuItem>
        <RenameInput
          defaultValue={project.name}
          onCommit={(name) => {
            const trimmed = name.trim()
            if (trimmed) renameProject(project.id, trimmed)
            onRenameEnd()
          }}
          onCancel={onRenameEnd}
        />
      </SidebarMenuItem>
    )
  }

  return (
    <SidebarMenuItem>
      <Collapsible open={expanded} onOpenChange={onToggle}>
        <ContextMenu>
          <ContextMenuTrigger
            render={
              <SidebarMenuButton
                onClick={onToggle}
                className="cursor-pointer group-has-data-[sidebar=menu-action]/menu-item:pr-12"
              />
            }
          >
            <AppIcon
              name={expanded ? "folderOpen" : "folder"}
              size={16}
              style={{ color: projectColor(project.id) }}
            />
            <span className="truncate" title={project.name}>
              {project.name}
            </span>
            <span className="ml-auto flex shrink-0 items-center gap-1">
              {(running || draftRunning) && (
                <AppIcon
                  name="loadingV2"
                  interaction="loop"
                  size={14}
                  className="text-muted-foreground"
                  aria-label="生成中"
                />
              )}
              <AppIcon
                name="chevronRight"
                size={16}
                className={cn("transition-transform", expanded && "rotate-90")}
              />
            </span>
          </ContextMenuTrigger>
          <ContextMenuContent>
            {actions.map((a) => (
              <ContextMenuItem
                key={a.label}
                variant={a.destructive ? "destructive" : undefined}
                onClick={a.onClick}
              >
                <AppIcon name={a.icon} size={16} />
                {a.label}
              </ContextMenuItem>
            ))}
          </ContextMenuContent>
        </ContextMenu>
        {/* 新对话：复用该项目未首聊的草稿（登记处单源），不重复堆空白槽 */}
        <SidebarMenuAction
          aria-label="新建对话"
          className="cursor-pointer"
          onClick={() =>
            onNavigate(
              useChatDraftsStore.getState().openDraft(project.id, project.id)
            )
          }
        >
          <AppIcon name="plus" size={16} />
        </SidebarMenuAction>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuAction
                showOnHover
                aria-label="项目操作"
                className="right-7 cursor-pointer"
              />
            }
          >
            <AppIcon name="moreHorizontal" size={16} />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start">
            {actions.map((a) => (
              <DropdownMenuItem
                key={a.label}
                variant={a.destructive ? "destructive" : undefined}
                onClick={a.onClick}
              >
                <AppIcon name={a.icon} size={16} />
                {a.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <CollapsibleContent>
          {conversations.length > 0 && (
            <SidebarMenuSub>
              {conversations.map((c) => (
                <ConversationRow
                  key={c.id}
                  conversation={c}
                  active={activeId === c.id}
                  renaming={renamingId === c.id}
                  onNavigate={onNavigate}
                  onRename={() => onRenameConversation(c.id)}
                  onRenameEnd={onRenameEnd}
                  onDelete={() => onDeleteConversation(c.id)}
                />
              ))}
            </SidebarMenuSub>
          )}
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  )
}

/** 项目列表（展开态分区与图标态浮层共用）：展开集、重命名、删除确认都在这层 */
function ProjectsList({ onNavigate }: { onNavigate: (to: string) => void }) {
  const projects = useProjectsStore((s) => s.projects)
  const conversations = useProjectsStore((s) => s.conversations)
  const { pathname, search } = useLocation()
  const activeId = new URLSearchParams(search).get("id")
  /** 同址跳过：复用草稿/重复点当前对话时不推冗余历史条目 */
  const go = (to: string) => {
    if (to !== pathname + search) onNavigate(to)
  }
  /** 手动展开/收起记录（显式选择优先于自动展开） */
  const [expandedMap, setExpandedMap] = useState<Map<string, boolean>>(new Map())
  /** 当前对话所属项目：无手动记录时默认展开（续聊/落库跳转后能直接在侧栏看到位置） */
  const activeProjectId = conversations.find((c) => c.id === activeId)?.projectId
  /** 正在重命名的行 id；null=无 */
  const [renamingId, setRenamingId] = useState<string | null>(null)
  /** 待确认删除的目标；null=不弹 */
  const [deleting, setDeleting] = useState<{
    kind: "project" | "conversation"
    id: string
    name: string
  } | null>(null)

  /** 删除目标是否生成中（项目=旗下任一）：确认文案追加停流提示 */
  const deletingRunning = useChatRunsStore((s) => {
    if (!deleting) return false
    if (deleting.kind === "conversation") return isRunning(s.runs, deleting.id)
    return conversations.some(
      (c) => c.projectId === deleting.id && isRunning(s.runs, c.id)
    )
  })

  /** 项目最后活跃：旗下对话 updatedAt 最大值，无对话回落创建时间 */
  const lastActive = (p: ChatProject) =>
    conversations.reduce(
      (m, c) => (c.projectId === p.id ? Math.max(m, c.updatedAt) : m),
      p.createdAt
    )
  /** 最近活跃倒序：活跃项目置顶 */
  const orderedProjects = [...projects].sort(
    (a, b) => lastActive(b) - lastActive(a)
  )

  /** 项目是否展开 @param id 项目 id @returns 展开态 */
  const expandedOf = (id: string) =>
    expandedMap.get(id) ?? id === activeProjectId

  /** 展开/收起项目 @param id 项目 id */
  const toggle = (id: string) =>
    setExpandedMap((prev) => new Map(prev).set(id, !expandedOf(id)))

  /** 确认删除：级联删项目对话；正在浏览被删对象时退回新建项目（等确认浮层收掉再切页） */
  const confirmDelete = () => {
    if (!deleting) return
    const store = useProjectsStore.getState()
    const params = new URLSearchParams(search)
    const viewingId = params.get("id")
    let leaveTo: string | null = null
    if (deleting.kind === "project") {
      const hit =
        params.get("project") === deleting.id ||
        conversations.some(
          (c) => c.id === viewingId && c.projectId === deleting.id
        )
      store.deleteProject(deleting.id)
      useChatDraftsStore.getState().clearScope(deleting.id)
      if (hit) leaveTo = useChatDraftsStore.getState().openDraft("new")
    } else {
      store.deleteConversation(deleting.id)
      if (viewingId === deleting.id)
        leaveTo = useChatDraftsStore.getState().openDraft("new")
    }
    setDeleting(null)
    if (leaveTo)
      window.setTimeout(() => go(leaveTo), OVERLAY_CLOSE_MS)
  }

  return (
    <>
      <SidebarMenu>
        {orderedProjects.map((p) => (
          <ProjectRow
            key={p.id}
            project={p}
            conversations={conversations
              .filter((c) => c.projectId === p.id)
              .sort((a, b) => b.updatedAt - a.updatedAt)}
            expanded={expandedOf(p.id)}
            activeId={activeId}
            renamingId={renamingId}
            onToggle={() => toggle(p.id)}
            onNavigate={go}
            onRename={() => setRenamingId(p.id)}
            onRenameEnd={() => setRenamingId(null)}
            onDelete={() =>
              setDeleting({ kind: "project", id: p.id, name: p.name })
            }
            onRenameConversation={setRenamingId}
            onDeleteConversation={(id) => {
              const conv = conversations.find((c) => c.id === id)
              if (conv)
                setDeleting({ kind: "conversation", id, name: conv.name })
            }}
          />
        ))}
      </SidebarMenu>
      {projects.length === 0 && (
        <p className="px-2 py-1 text-xs text-muted-foreground">
          暂无项目，点击新建项目开始第一对话
        </p>
      )}
      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleting?.kind === "project" ? "删除项目" : "删除对话"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.kind === "project"
                ? `删除「${deleting.name}」及其全部对话，不可恢复。`
                : `删除对话「${deleting?.name ?? ""}」，不可恢复。`}
              {deletingRunning && " 正在生成的内容将被停止。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/** 图标折叠态：单枚项目图标，悬停右侧浮出完整项目列表 */
function ProjectsFlyout({ onNavigate }: { onNavigate: (to: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <SidebarGroup className="shrink-0">
      <SidebarMenu>
        <SidebarMenuItem>
          <HoverCard open={open} onOpenChange={setOpen}>
            {/* delay=0：悬停直接出项目列表，不走小提示 */}
            <HoverCardTrigger
              delay={0}
              render={
                <SidebarMenuButton aria-label="项目" className="cursor-pointer" />
              }
            >
              {/* 浮层展开时换开盒图标，与项目行的开合语义一致 */}
              <AppIcon name={open ? "folderOpen" : "folder"} size={16} />
            </HoverCardTrigger>
            <HoverCardContent
              side="right"
              align="start"
              className="flex max-h-96 w-72 flex-col p-2"
            >
              <p className="shrink-0 px-2 pb-1 text-xs font-medium text-muted-foreground">
                项目
              </p>
              <ScrollArea className="min-h-0 flex-1">
                <ProjectsList
                  onNavigate={(to) => {
                    // 先收浮层再切页：轨道平移不能在浮层背后跑完
                    setOpen(false)
                    window.setTimeout(() => onNavigate(to), OVERLAY_CLOSE_MS)
                  }}
                />
              </ScrollArea>
            </HoverCardContent>
          </HoverCard>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  )
}

/** 侧栏项目分区入口
 * @param allowIcon 是否允许图标折叠态渲染（悬浮侧栏恒全宽，传 false） */
export function SidebarProjects({ allowIcon = true }: { allowIcon?: boolean }) {
  const { state, isMobile } = useSidebar()
  const go = useSidebarNavigate()

  if (allowIcon && state === "collapsed" && !isMobile) {
    return <ProjectsFlyout onNavigate={go} />
  }
  return (
    <SidebarGroup className="min-h-0 flex-1">
      <SidebarGroupLabel>项目</SidebarGroupLabel>
      <SidebarGroupContent className="min-h-0 flex-1">
        <ScrollArea className="h-full">
          <ProjectsList onNavigate={go} />
        </ScrollArea>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}