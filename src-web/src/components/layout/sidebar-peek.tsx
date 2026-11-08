// 完全隐藏态的悬浮侧栏：贴左边缘热区唤出官方 Sheet（非模态），离开短暂延迟后收回

import { useEffect, useRef, useState } from "react"

import { SidebarBody } from "@/components/layout/sidebar-body"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

/** 鼠标离开后延迟收回（ms），留出从边缘移入面板的时间 */
const HIDE_DELAY_MS = 200

export function SidebarPeek() {
  /** 面板是否滑出 */
  const [shown, setShown] = useState(false)
  /** 延迟收回定时器 id */
  const hideTimer = useRef(0)

  useEffect(() => () => clearTimeout(hideTimer.current), [])

  /** 热区/面板进入：取消收回并立即弹出 */
  const reveal = () => {
    clearTimeout(hideTimer.current)
    setShown(true)
  }
  /** 离开：延迟收回 */
  const scheduleHide = () => {
    hideTimer.current = window.setTimeout(() => setShown(false), HIDE_DELAY_MS)
  }

  return (
    <Sheet open={shown} onOpenChange={setShown} modal={false}>
      {/* 左边缘热区（窄条，不遮挡内容点击）：hover 唤出，点击走官方 Trigger 兜底触屏 */}
      <SheetTrigger
        aria-label="显示侧栏"
        className="absolute inset-y-0 left-0 z-20 w-3 cursor-default"
        onMouseEnter={reveal}
        onMouseLeave={scheduleHide}
      />
      {/* 悬浮面板：官方非模态 Sheet；定位/宽度/磨砂/描边统一由 index.scss 的 sidebar-peek 契约条目给
          （Sheet 走 body Portal，位置以全窗为基准，故需让位标题栏带） */}
      <SheetContent
        data-slot="sidebar-peek"
        side="left"
        showCloseButton={false}
        className="gap-0 overflow-hidden rounded-xl p-0 shadow-2xl"
        onMouseEnter={reveal}
        onMouseLeave={scheduleHide}
      >
        <SheetTitle className="sr-only">导航</SheetTitle>
        <div className="flex h-full w-full flex-col text-sidebar-foreground">
          <SidebarBody tooltip={false} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
