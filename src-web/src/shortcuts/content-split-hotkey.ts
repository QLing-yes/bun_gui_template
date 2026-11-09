// 内容区分栏收起热键：键位取自 shortcuts/registry，行为切换对应侧收起态（与标题栏共用同一 store）

import { useEffect } from "react"

import { comboMatches, shortcutById } from "@/shortcuts/registry"
import { useContentSplitStore } from "@/store/content-split"

/** 注册右栏/底栏收起切换热键（自动收起期间由 store 静默忽略） */
export function useContentSplitHotkey(): void {
  useEffect(() => {
    const rightCombos = shortcutById("content-split-right")?.combos ?? []
    const bottomCombos = shortcutById("content-split-bottom")?.combos ?? []
    /** 命中任一登记组合键即切换对应侧 */
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (rightCombos.some((c) => comboMatches(c, e))) {
        e.preventDefault()
        useContentSplitStore.getState().toggle("right", "hotkey")
        return
      }
      if (bottomCombos.some((c) => comboMatches(c, e))) {
        e.preventDefault()
        useContentSplitStore.getState().toggle("bottom", "hotkey")
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])
}
