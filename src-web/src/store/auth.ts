// 全局鉴权状态：zustand + persist（登录校验预留，当前任意凭据直接通过）

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { storageAdapter, STORAGE_KEYS } from "@/lib/storage"

/** 持久化的鉴权状态字段与行为 */
interface AuthState {
  /** 已登录用户名；null = 未登录 */
  username: string | null
  /** 登录（预留：接入真实校验前仅记录用户名） @param username 用户名 */
  login: (username: string) => void
  /** 退出登录（预留：仅清除本地登录态） */
  logout: () => void
}

/** 把持久化载荷读成合法登录态：非字符串用户名一律按未登录处理（下游直接取其首字符展示）
 * @param persisted 存储载荷 @returns username 字段 */
function readAuthData(persisted: unknown): { username: string | null } {
  const name = (persisted as Partial<AuthState> | null | undefined)?.username
  return { username: typeof name === "string" ? name : null }
}

/** 全局鉴权 store；仅 username 序列化到持久化层（函数值自动跳过） */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      username: null,
      login: (username) => set({ username }),
      logout: () => set({ username: null }),
    }),
    {
      name: STORAGE_KEYS.auth,
      // 落盘统一走 lib/storage 的按键防抖
      storage: createJSONStorage(() => storageAdapter),
      // 每次加载都收敛一遍，挡住手改存储塞进来的非字符串
      merge: (persisted, current) => ({
        ...current,
        ...readAuthData(persisted),
      }),
    }
  )
)
