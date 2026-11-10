// 聊天生成态登记处：运行态、不持久化、不跨窗口同步（流式本身就在本窗口）
// 槽地址 → 正在生成的对话/草稿 id；侧栏由此派生「生成中」指示（含冻结槽与草稿期）

import { create } from "zustand"

/** 运行态：槽完整地址 → 正在生成的对话 id */
interface ChatRunsState {
  /** 生成中标记 */
  runs: Record<string, string>
  /** 置/清槽的生成中标记 @param slot 槽完整地址 @param id 对话 id；null=清除 */
  setRun: (slot: string, id: string | null) => void
}

/** 全局生成态 store（运行态单例，不接 persist） */
export const useChatRunsStore = create<ChatRunsState>()((set) => ({
  runs: {},
  setRun: (slot, id) =>
    set((s) => {
      const next = { ...s.runs }
      if (id) next[slot] = id
      else delete next[slot]
      return { runs: next }
    }),
}))

/** 对话是否在任何槽生成中 @param runs 登记快照 @param id 对话 id @returns 是否生成中 */
export function isRunning(runs: Record<string, string>, id: string): boolean {
  return Object.values(runs).includes(id)
}