// 内容区分栏收起态单源：标题栏按钮/快捷键/布局层共用同一份值（不接 persist）
// 尺寸与收起态仍按 STORAGE_KEYS.contentSplit 一个键由 layout/content-layout 读写；本 store 只存运行态标记

import { create } from "zustand"

/** 内容区分栏的面板方位 */
export type ContentSplitSide = "right" | "bottom"

/** 收起态切换来源（DEV 日志用；面板自身入口已移除，保留枚举便于排查） */
export type ContentSplitSource = "titlebar" | "hotkey" | "panel"

/** 内容区分栏收起态与动作 */
interface ContentSplitState {
  /** 右栏是否由用户收起 */
  rightCollapsed: boolean
  /** 底栏是否由用户收起 */
  bottomCollapsed: boolean
  /** 右栏是否因空间不足自动收起 */
  autoRight: boolean
  /** 底栏是否因空间不足自动收起 */
  autoBottom: boolean
  /** 一次性灌入持久化收起态 @param right 右栏是否收起 @param bottom 底栏是否收起 */
  hydrate: (right: boolean, bottom: boolean) => void
  /** 更新自动收起标记 @param right 右栏 @param bottom 底栏 @returns 是否有变化 */
  setAuto: (right: boolean, bottom: boolean) => boolean
  /** 切换某侧收起态（自动收起期间忽略并留痕） @param side 方位 @param source 触发来源 */
  toggle: (side: ContentSplitSide, source: ContentSplitSource) => void
}

/** 内容区分栏收起态 store（运行态，不落盘；持久化归 content-layout 的尺寸提交） */
export const useContentSplitStore = create<ContentSplitState>()((set, get) => ({
  rightCollapsed: false,
  bottomCollapsed: false,
  autoRight: false,
  autoBottom: false,
  hydrate: (right, bottom) => {
    const s = get()
    if (s.rightCollapsed === right && s.bottomCollapsed === bottom) return
    set({ rightCollapsed: right, bottomCollapsed: bottom })
  },
  setAuto: (right, bottom) => {
    const s = get()
    if (s.autoRight === right && s.autoBottom === bottom) return false
    set({ autoRight: right, autoBottom: bottom })
    return true
  },
  toggle: (side, source) => {
    const s = get()
    const blocked = side === "right" ? s.autoRight : s.autoBottom
    if (blocked) {
      if (import.meta.env.DEV) {
        console.debug("[content-split] toggle-blocked", {
          side,
          source,
          reason: "auto-collapsed",
        })
      }
      return
    }
    if (side === "right") set({ rightCollapsed: !s.rightCollapsed })
    else set({ bottomCollapsed: !s.bottomCollapsed })
    if (import.meta.env.DEV) {
      console.debug("[content-split] toggle", {
        side,
        source,
        collapsed: side === "right" ? !s.rightCollapsed : !s.bottomCollapsed,
      })
    }
  },
}))
