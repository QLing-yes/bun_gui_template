// 未落库聊天草稿登记处：运行态、不持久化、不跨窗口同步（同 content-split 模式）
// 每个范围（新建项目/各项目）至多一个草稿：再点新建复用未首聊的草稿地址，不重复堆空白槽

import { create } from "zustand"

/** 草稿 @property id 草稿标识（地址 ?draft= 值） @property address 草稿完整地址 */
export interface ChatDraft {
  id: string
  address: string
}

/** 运行态：范围键 → 草稿（键 "new"=新建项目，其余=项目 id） */
interface ChatDraftsState {
  /** 在册草稿 */
  drafts: Record<string, ChatDraft>
  /** 开草稿：范围已有则复用其地址，否则新建 @param key 范围键 @param projectId 所属项目（新建项目省略） @returns 草稿地址 */
  openDraft: (key: string, projectId?: string) => string
  /** 按草稿 id 清除（首条回复落库后调） @param id 草稿 id */
  clearDraft: (id: string) => void
  /** 按范围清除（项目删除时调） @param key 范围键 */
  clearScope: (key: string) => void
}

/** 全局草稿登记 store（运行态单例，不接 persist） */
export const useChatDraftsStore = create<ChatDraftsState>()((set, get) => ({
  drafts: {},
  openDraft: (key, projectId) => {
    const existing = get().drafts[key]
    if (existing) return existing.address
    const id = crypto.randomUUID()
    const address = projectId
      ? `/chat?project=${projectId}&draft=${id}`
      : `/?draft=${id}`
    set((s) => ({ drafts: { ...s.drafts, [key]: { id, address } } }))
    return address
  },
  clearDraft: (id) =>
    set((s) => ({
      drafts: Object.fromEntries(
        Object.entries(s.drafts).filter(([, draft]) => draft.id !== id)
      ),
    })),
  clearScope: (key) =>
    set((s) => {
      const next = { ...s.drafts }
      delete next[key]
      return { drafts: next }
    }),
}))