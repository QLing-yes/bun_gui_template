// 自定义标题栏：侧栏三态开关/前进后退 + 拖动区域 + 主题切换 + 窗口控制

import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react"
import { useNavigate } from "react-router"

import { ChromeActions, ChromeGroup } from "@/components/layout/chrome-group"
import { IconAction } from "@/components/layout/icon-action"
import { SidebarCycleTrigger } from "@/components/layout/sidebar-cycle-trigger"
import { WindowDragRegion } from "@/components/layout/window-drag-region"
import { useHistoryNav } from "@/hooks/use-history-nav"

export function TitleBar() {
  const navigate = useNavigate()
  const { canGoBack, canGoForward } = useHistoryNav()

  return (
    <header
      data-slot="title-bar"
      className="flex h-titlebar shrink-0 items-center justify-between select-none"
    >
      {/* 左侧：侧栏开关、后退、前进（no-drag 保持按钮可点击） */}
      <ChromeGroup side="left">
        <SidebarCycleTrigger />
        <IconAction
          hint="后退"
          button={{ disabled: !canGoBack, onClick: () => navigate(-1) }}
        >
          <ArrowLeftIcon className="size-4 shrink-0" />
        </IconAction>
        <IconAction
          hint="前进"
          button={{ disabled: !canGoForward, onClick: () => navigate(1) }}
        >
          <ArrowRightIcon className="size-4 shrink-0" />
        </IconAction>
      </ChromeGroup>

      {/* 中间：拖动区域（左键拖动、双击切换最大化） */}
      <WindowDragRegion />

      {/* 右侧：主题切换 + 窗口置顶 + 窗口控制（与登录页共用同一动作簇） */}
      <ChromeActions />
    </header>
  )
}
