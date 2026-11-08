// 侧栏底部用户区：头像+用户名+设置icon；点击弹出操作菜单（明暗模式内嵌选项切换、个性化、设置、登录/退出）

import {
  ContrastIcon,
  LogInIcon,
  LogOutIcon,
  PaletteIcon,
  SettingsIcon,
  UserIcon,
} from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router"

import { SIDEBAR_LABEL_CLASS } from "@/components/layout/class-names"
import { ThemeMenu } from "@/components/layout/theme-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useAuthStore } from "@/store/auth"

/** 浮层关闭时长：菜单还开着就切页/切主题，全屏动画会在浮层背后跑完（等于看不见），等浮层消失再动 */
const MENU_CLOSE_MS = 120

export function SidebarUser() {
  const navigate = useNavigate()
  const username = useAuthStore((s) => s.username)
  const logout = useAuthStore((s) => s.logout)
  /** 菜单受控开关：明暗档要在菜单里滑完游标再收，不能被菜单的自动关闭打断 */
  const [open, setOpen] = useState(false)

  /** 菜单项切页：延后到菜单消失，动画本体仍由路由轨道决定 @param to 目标地址 */
  const goTo = (to: string) => {
    window.setTimeout(() => navigate(to), MENU_CLOSE_MS)
  }

  return (
    <SidebarFooter>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger render={<SidebarMenuButton size="lg" />}>
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  {/* 头像占位：用户名首字符，未登录用图标 */}
                  {username ? (
                    username.charAt(0).toUpperCase()
                  ) : (
                    <UserIcon className="size-4 shrink-0" />
                  )}
                </AvatarFallback>
              </Avatar>
              {/* 折叠成图标时名称与设置图标淡出，仅留头像 */}
              <div className={SIDEBAR_LABEL_CLASS}>
                <span className="truncate font-semibold">
                  {username ?? "未登录"}
                </span>
              </div>
              <SettingsIcon className="ml-auto size-4 shrink-0 transition-opacity group-data-[collapsible=icon]:opacity-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align="start"
              className="min-w-56 rounded-lg"
            >
              {/* 明暗档行：右侧内嵌选项切换（不是菜单项——控件要在菜单里就地操作并看得见游标滑行） */}
              <div
                data-slot="dropdown-menu-theme-row"
                className="flex items-center gap-2 px-1.5 py-1 text-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <ContrastIcon className="size-4 shrink-0" />
                <span className="flex-1">明暗模式</span>
                {/* 侧栏形态：滑完游标先收菜单，切换事务再等浮层消失；命中当前档不触发收菜单 */}
                <ThemeMenu
                  skipSame
                  onSlideDone={() => setOpen(false)}
                  settleExtraMs={MENU_CLOSE_MS}
                />
              </div>
              <DropdownMenuItem
                onClick={() => goTo("/settings?section=personalize")}
              >
                <PaletteIcon className="size-4 shrink-0" />
                个性化
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => goTo("/settings")}>
                <SettingsIcon className="size-4 shrink-0" />
                设置
              </DropdownMenuItem>
              {username ? (
                <DropdownMenuItem onClick={logout}>
                  <LogOutIcon className="size-4 shrink-0" />
                  退出登录
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => goTo("/login")}>
                  <LogInIcon className="size-4 shrink-0" />
                  去登录
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  )
}
