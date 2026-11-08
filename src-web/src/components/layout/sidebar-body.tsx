// 侧栏正文：品牌 + 导航 + 用户区；固定侧栏与完全隐藏态的悬浮侧栏共用同一组件

import { SidebarBrand } from "@/components/layout/sidebar-brand"
import { SidebarNav } from "@/components/layout/sidebar-nav"
import { SidebarUser } from "@/components/layout/sidebar-user"
import { SidebarContent } from "@/components/ui/sidebar"

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
