// 项目与对话数据：zustand + persist（单键落库，键名登记见 lib/storage.ts）
// 落库时机由聊天页决定：首条 AI 回复完整完成才创建项目/对话；本 store 只提供纯数据动作

import type { UIMessage } from "ai"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { storageAdapter, STORAGE_KEYS } from "@/lib/storage"

/** 项目落库时的占位名（AI 命名返回前的过渡值） */
export const PROJECT_PLACEHOLDER = "新项目"
/** 对话落库时的占位名（AI 命名返回前的过渡值） */
export const CONVERSATION_PLACEHOLDER = "新对话"

/** 项目 @property id 唯一标识 @property name 项目名（AI 生成、可重命名） @property createdAt 创建时间戳 */
export interface ChatProject {
  id: string
  name: string
  createdAt: number
}

/** 对话 @property id 唯一标识 @property projectId 所属项目 @property name 对话名（AI 生成、可重命名） @property messages 全量消息（续聊时原样回传后端） @property createdAt 创建时间戳 @property updatedAt 最近一次回复完成时间戳 */
export interface ChatConversation {
  id: string
  projectId: string
  name: string
  messages: UIMessage[]
  createdAt: number
  updatedAt: number
}

/** 持久化的项目数据字段与行为 */
interface ProjectsState {
  /** 全部项目（创建顺序） */
  projects: ChatProject[]
  /** 全部对话（创建顺序，归属 projectId） */
  conversations: ChatConversation[]
  /** 创建项目 @param name 项目名 @returns 新项目 id */
  createProject: (name: string) => string
  /** 在项目下创建对话 @param projectId 所属项目 @param name 对话名 @param messages 首回复完成时的全量消息 @returns 新对话 id */
  addConversation: (
    projectId: string,
    name: string,
    messages: UIMessage[]
  ) => string
  /** 覆盖对话消息（每次回复完成后整份更新） @param id 对话 id @param messages 全量消息 */
  setMessages: (id: string, messages: UIMessage[]) => void
  /** 重命名项目 @param id 项目 id @param name 新项目名 */
  renameProject: (id: string, name: string) => void
  /** 重命名对话 @param id 对话 id @param name 新对话名 */
  renameConversation: (id: string, name: string) => void
  /** 删除项目（级联删除其全部对话） @param id 项目 id */
  deleteProject: (id: string) => void
  /** 删除对话 @param id 对话 id */
  deleteConversation: (id: string) => void
}

/** 全局项目 store；仅数据数组序列化到持久化层（函数值自动跳过） */
export const useProjectsStore = create<ProjectsState>()(
  persist(
    (set) => ({
      projects: [],
      conversations: [],
      createProject: (name) => {
        const id = crypto.randomUUID()
        set((s) => ({
          projects: [...s.projects, { id, name, createdAt: Date.now() }],
        }))
        return id
      },
      addConversation: (projectId, name, messages) => {
        const id = crypto.randomUUID()
        const now = Date.now()
        set((s) => ({
          conversations: [
            ...s.conversations,
            { id, projectId, name, messages, createdAt: now, updatedAt: now },
          ],
        }))
        return id
      },
      setMessages: (id, messages) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, messages, updatedAt: Date.now() } : c
          ),
        })),
      renameProject: (id, name) =>
        set((s) => ({
          projects: s.projects.map((p) => (p.id === id ? { ...p, name } : p)),
        })),
      renameConversation: (id, name) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, name } : c
          ),
        })),
      deleteProject: (id) =>
        set((s) => ({
          projects: s.projects.filter((p) => p.id !== id),
          conversations: s.conversations.filter((c) => c.projectId !== id),
        })),
      deleteConversation: (id) =>
        set((s) => ({
          conversations: s.conversations.filter((c) => c.id !== id),
        })),
    }),
    {
      name: STORAGE_KEYS.projects,
      // IndexedDB 异步适配器；水合由 AppBoot 统一触发
      storage: createJSONStorage(() => storageAdapter),
      skipHydration: true,
      // 非数组载荷一律按空库处理，挡住手改存储塞进来的坏值
      merge: (persisted, current) => {
        const data = persisted as Partial<ProjectsState> | null | undefined
        return {
          ...current,
          projects: Array.isArray(data?.projects) ? data.projects : [],
          conversations: Array.isArray(data?.conversations)
            ? data.conversations
            : [],
        }
      },
    }
  )
)