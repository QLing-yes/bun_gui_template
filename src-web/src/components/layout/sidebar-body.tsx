// 侧栏正文：品牌 + 导航 + 项目分区 + 用户区；固定侧栏与完全隐藏态的悬浮侧栏共用同一组件
// 品牌与导航是纯展示段，就地定义；项目分区带展开/菜单交互，单独成文件（sidebar-projects.tsx）；用户区同理（sidebar-user.tsx）

import { useEffect } from "react"
import { useLocation, useNavigate } from "react-router"

import { BRAND_NAME, BrandLogo } from "@/components/brand-logo"
import { AppIcon } from "@/components/icons"
import { SIDEBAR_LABEL_CLASS } from "@/components/layout/class-names"
import { SidebarProjects } from "@/components/layout/sidebar-projects"
import { SidebarUser } from "@/components/layout/sidebar-user"
import {
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useAccess } from "@/lib/access"
import { OVERLAY_CLOSE_MS } from "@/lib/motion"
import { navItems } from "@/routes/registry"
import { useChatDraftsStore } from "@/store/chat-drafts"
import { useChatRunsStore } from "@/store/chat-runs"
import { cn } from "cn"

/** 侧栏头部品牌区：logo + 应用名（折叠成图标态时仅剩 logo） */
function SidebarBrand() {
  return (
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            className="group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0"
          >
            <BrandLogo />
            {/* 折叠成图标时名称淡出并退出占位（flex-none + w-0），使 logo 在图标栏内左右居中 */}
            <div
              className={cn(
                SIDEBAR_LABEL_CLASS,
                "group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:flex-none"
              )}
            >
              <span className="truncate font-semibold">{BRAND_NAME}</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
  )
}

/** 导航区：清单由 routes/registry 派生（页面归属/顺序/桌面端门控都在路由表）
 * @param tooltip 图标折叠态是否显示右侧项名提示（悬浮面板等全宽场景传 false） */
function SidebarNav({ tooltip = true }: { tooltip?: boolean }) {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const { isMobile, setOpenMobile } = useSidebar()
  /** 权限判定（与页面准入同源）：账号变化即重算，受限项仍可见、可点击（进页后由页面层展示空状态） */
  const checkAccess = useAccess()
  /** 存在未首聊新建草稿：导航提示改「继续草稿」，复用点击不像死按钮 */
  const hasNewDraft = useChatDraftsStore((s) => Boolean(s.drafts["new"]))
  /** 任一草稿生成中：新建项目项显加载徽标（草稿期没有对话行可挂徽标） */
  const runs = useChatRunsStore((s) => s.runs)
  const drafts = useChatDraftsStore((s) => s.drafts)
  const draftRunning = Object.values(runs).some((id) =>
    Object.values(drafts).some((d) => d.id === id)
  )

  /** 导航：移动端先收抽屉再动，桌面直接走 @param to 目标地址 */
  const goTo = (to: string) => {
    if (!isMobile) {
      navigate(to)
      return
    }
    setOpenMobile(false)
    window.setTimeout(() => navigate(to), OVERLAY_CLOSE_MS)
  }

  // 关键位置日志：受限菜单项的渲染结果（判定依据见 lib/access 的占位授权表）
  useEffect(() => {
    if (!import.meta.env.DEV) return
    console.debug(
      "[access] menu restricted",
      navItems
        .filter((item) => !checkAccess(item.access))
        .map((item) => item.to)
    )
  }, [checkAccess])

  return (
    <SidebarGroup className="shrink-0">
      <SidebarMenu>
        {navItems.map((item) => {
          const allowed = checkAccess(item.access)
          // 受限项的原因说明：图标折叠态由 tooltip 展示，展开态由 title 展示
          const reason = allowed
            ? undefined
            : `需要${item.access?.label ?? "权限"}`
          const isNew = item.to === "/"
          const draftHint =
            isNew && hasNewDraft ? "继续未完成的草稿" : undefined
          // 新建项目复用未首聊的草稿（登记处单源），不重复堆空白槽
          return (
            <SidebarMenuItem key={item.to}>
              <SidebarMenuButton
                onClick={() => {
                  const to =
                    item.to === "/"
                      ? useChatDraftsStore.getState().openDraft("new")
                      : item.to
                  // 同址跳过：复用草稿命中当前页时不推冗余历史条目
                  if (to !== pathname + search) goTo(to)
                }}
                isActive={
                  item.to === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.to)
                }
                tooltip={
                  tooltip
                    ? allowed
                      ? (draftHint ?? item.label)
                      : `${item.label}（${reason}）`
                    : undefined
                }
                title={reason ?? draftHint}
                data-restricted={allowed ? undefined : ""}
                className={cn("cursor-pointer", !allowed && "opacity-60")}
              >
                <AppIcon name={item.icon} size={16} />
                <span>{item.label}</span>
                {isNew && draftRunning && (
                  <AppIcon
                    name="loadingV2"
                    interaction="loop"
                    size={14}
                    className="ml-auto text-muted-foreground group-data-[collapsible=icon]:hidden"
                  />
                )}
                {!allowed && (
                  <AppIcon
                    name="lock"
                    size={14}
                    className="ml-auto text-muted-foreground group-data-[collapsible=icon]:hidden"
                  />
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}

/** 侧栏内容（不含外层 Sidebar 容器本身）：导航固定、项目分区占余高区域滚动
 * @param tooltip 导航项是否在图标态显示右侧提示；悬浮面板恒为全宽，传 false 抑制（项目分区也不收成图标态） */
export function SidebarBody({ tooltip = true }: { tooltip?: boolean }) {
  return (
    <>
      <SidebarBrand />
      <SidebarContent>
        <SidebarNav tooltip={tooltip} />
        <SidebarProjects allowIcon={tooltip} />
      </SidebarContent>
      <SidebarUser />
    </>
  )
}
