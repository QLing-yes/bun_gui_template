// 侧边栏导航：清单由 routes/registry 派生（页面归属/顺序/桌面端门控都在路由表），本文件只管渲染与激活判定

import { NavLink, useLocation } from "react-router"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { navItems } from "@/routes/registry"

/** 导航区 @param tooltip 图标折叠态是否显示右侧项名提示（悬浮面板等全宽场景传 false） */
export function SidebarNav({ tooltip = true }: { tooltip?: boolean }) {
  const { pathname } = useLocation()

  return (
    <SidebarGroup>
      <SidebarGroupLabel>导航</SidebarGroupLabel>
      <SidebarMenu>
        {navItems.map((item) => (
          <SidebarMenuItem key={item.to}>
            <SidebarMenuButton
              render={<NavLink to={item.to} />}
              isActive={
                item.to === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.to)
              }
              tooltip={tooltip ? item.label : undefined}
            >
              <item.icon className="size-4 shrink-0" />
              <span>{item.label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
