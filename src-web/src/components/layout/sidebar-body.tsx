// 侧栏正文：品牌 + 导航 + 用户区；固定侧栏与完全隐藏态的悬浮侧栏共用同一组件
// 品牌与导航是纯展示段，就地定义；用户区带菜单交互，单独成文件（sidebar-user.tsx）

import { LockIcon } from "lucide-react"
import { useEffect } from "react"
import { NavLink, useLocation } from "react-router"

import { BRAND_NAME, BrandLogo } from "@/components/brand-logo"
import { SIDEBAR_LABEL_CLASS } from "@/components/layout/class-names"
import { SidebarUser } from "@/components/layout/sidebar-user"
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useAccess } from "@/lib/access"
import { navItems } from "@/routes/registry"
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
  const { pathname } = useLocation()
  /** 权限判定（与页面准入同源）：账号变化即重算，受限项仍可见、可点击（进页后由页面层展示空状态） */
  const checkAccess = useAccess()

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
    <SidebarGroup>
      <SidebarGroupLabel>导航</SidebarGroupLabel>
      <SidebarMenu>
        {navItems.map((item) => {
          const allowed = checkAccess(item.access)
          // 受限项的原因说明：图标折叠态由 tooltip 展示，展开态由 title 展示
          const reason = allowed
            ? undefined
            : `需要${item.access?.label ?? "权限"}`
          return (
            <SidebarMenuItem key={item.to}>
              <SidebarMenuButton
                render={<NavLink to={item.to} />}
                isActive={
                  item.to === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.to)
                }
                tooltip={
                  tooltip
                    ? allowed
                      ? item.label
                      : `${item.label}（${reason}）`
                    : undefined
                }
                title={reason}
                data-restricted={allowed ? undefined : ""}
                className={allowed ? undefined : "opacity-60"}
              >
                <item.icon className="size-4 shrink-0" />
                <span>{item.label}</span>
                {!allowed && (
                  <LockIcon className="ml-auto size-3.5 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}

/** 侧栏内容三段（不含外层 Sidebar 容器本身）
 * @param tooltip 导航项是否在图标态显示右侧提示；悬浮面板恒为全宽，传入 false 抑制 */
export function SidebarBody({ tooltip = true }: { tooltip?: boolean }) {
  return (
    <>
      <SidebarBrand />
      <SidebarContent>
        <SidebarNav tooltip={tooltip} />
      </SidebarContent>
      <SidebarUser />
    </>
  )
}
