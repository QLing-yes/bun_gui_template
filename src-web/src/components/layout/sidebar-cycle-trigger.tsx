// 侧栏三态开关：完全显示 → 图标折叠 → 完全隐藏 循环；提示文案描述下一次点击的效果

import { AppIcon } from "@/components/icons"
import type { AppIconName } from "@/components/icons"

import { IconAction } from "@/components/layout/icon-action"
import { useSidebar } from "@/components/ui/sidebar"
import { useUiStore, type SidebarMode } from "@/store/ui"

/** 当前状态 → 下一次点击的效果提示 */
const nextHint: Record<SidebarMode, string> = {
  expanded: "折叠侧边栏",
  icon: "隐藏侧边栏",
  hidden: "显示侧边栏",
}

/** 当前状态 → 按钮图标（表现下一次点击的动作；同系 panel-left 图形，避免混用视线符号） */
const nextIcon: Record<SidebarMode, AppIconName> = {
  expanded: "panelLeftClose",
  icon: "panelLeftInactive",
  hidden: "panelLeftOpen",
}

/** 移动端语义是抽屉开合 @param hidden 侧栏是否处于隐藏态 @param open 抽屉是否打开 @returns 下一次点击的提示 */
function mobileHint(hidden: boolean, open: boolean): string {
  if (hidden) return "显示侧边栏"
  return open ? "关闭侧边栏" : "打开侧边栏"
}

export function SidebarCycleTrigger() {
  const { isMobile, openMobile, toggleSidebar } = useSidebar()
  const sidebarMode = useUiStore((s) => s.sidebarMode)
  const cycleSidebarMode = useUiStore((s) => s.cycleSidebarMode)
  const setSidebarMode = useUiStore((s) => s.setSidebarMode)

  /** 桌面端走三态循环；移动端抽屉不受折叠态影响，仅负责开合 */
  const handleClick = () => {
    if (!isMobile) return cycleSidebarMode()
    // 隐藏态下抽屉组件未挂载，先恢复挂载再打开
    if (sidebarMode === "hidden") setSidebarMode("expanded")
    toggleSidebar()
  }

  const hidden = sidebarMode === "hidden"
  const icon: AppIconName = isMobile
    ? openMobile
      ? "panelLeftClose"
      : "panelLeftOpen"
    : nextIcon[sidebarMode]
  const hint = isMobile ? mobileHint(hidden, openMobile) : nextHint[sidebarMode]

  return (
    <IconAction hint={hint} button={{ onClick: handleClick }}>
      <AppIcon name={icon} size={16} />
    </IconAction>
  )
}
