// 侧栏三态热键：键位取自 shortcuts/registry，行为是循环三态（注册表内置的两态开关已移除）

import { useEffect } from "react"

import { useIsMobile } from "@/hooks/use-mobile"
import { comboMatches, shortcutById } from "@/shortcuts/registry"
import { useUiStore } from "@/store/ui"

/** 注册侧栏三态循环热键；移动端不拦截（抽屉开合另有触发器） */
export function useSidebarHotkey(): void {
  const isMobile = useIsMobile()
  const cycleSidebarMode = useUiStore((s) => s.cycleSidebarMode)

  useEffect(() => {
    if (isMobile) return
    const combos = shortcutById("sidebar")?.combos ?? []
    /** 命中任一登记组合键即循环下一模式 */
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.altKey) return
      if (!combos.some((c) => comboMatches(c, e))) return
      e.preventDefault()
      cycleSidebarMode()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isMobile, cycleSidebarMode])
}
