// 全局鉴权状态：zustand + persist（登录/注册/刷新/登出走后端 API，token 持久化到 IndexedDB）

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { client } from "@/lib/api"
import { storageAdapter, STORAGE_KEYS } from "@/lib/storage"

/** 后端返回的用户信息（登录/注册/刷新共用） */
interface AuthUser {
  id: number
  username: string
}

/** 持久化的鉴权状态字段与行为 */
interface AuthState {
  /** 已登录用户；null = 未登录 */
  user: AuthUser | null
  /** access token（JWT，放 Authorization: Bearer） */
  accessToken: string | null
  /** refresh token（仅用于换新，不直接用于 API 鉴权） */
  refreshToken: string | null
  /** 用户权限编号集合（从 /system/auth/me 拉取，未登录为空） */
  perms: readonly number[]
  /** 登录（用户名/邮箱/手机号 + 密码） @returns 成功 true，失败 false */
  login: (identifier: string, password: string) => Promise<boolean>
  /** 注册（用户名 + 密码） @returns 成功 true，失败 false */
  register: (username: string, password: string) => Promise<boolean>
  /** 刷新令牌（旧 refresh token 立即失效） @returns 成功 true，失败 false */
  refresh: () => Promise<boolean>
  /** 拉取当前用户权限编号（/system/auth/me） */
  fetchPerms: () => Promise<void>
  /** 退出登录（撤销后端会话 + 清除本地登录态） */
  logout: () => Promise<void>
}

/** 拉取当前用户权限编号（失败静默，不阻塞登录流程）
 * @param token access token @returns 权限编号数组 */
async function fetchUserPerms(token: string): Promise<number[]> {
  const { data } = await client.system.auth.me.get({
    headers: { Authorization: `Bearer ${token}` },
  })
  return data ? ((data as { perms?: number[] }).perms ?? []) : []
}

/** 把持久化载荷读成合法登录态：user 必须是含 username 的对象，token 必须是非空字符串
 * @param persisted 存储载荷 @returns user/accessToken/refreshToken 字段 */
function readAuthData(
  persisted: unknown
): Pick<AuthState, "user" | "accessToken" | "refreshToken" | "perms"> {
  const p = persisted as Partial<AuthState> | null | undefined
  const user =
    p?.user && typeof p.user === "object" && "username" in p.user
      ? (p.user as AuthUser)
      : null
  const accessToken =
    typeof p?.accessToken === "string" && p.accessToken ? p.accessToken : null
  const refreshToken =
    typeof p?.refreshToken === "string" && p.refreshToken
      ? p.refreshToken
      : null
  // 三者任一缺失则整体置空（避免半残登录态）
  if (!user || !accessToken)
    return { user: null, accessToken: null, refreshToken: null, perms: [] }
  return { user, accessToken, refreshToken, perms: p?.perms ?? [] }
}

/** 全局鉴权 store；user + accessToken + refreshToken + perms 序列化到持久化层（函数值自动跳过） */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      perms: [],
      login: async (identifier, password) => {
        const { data, error, status } = await client.system.auth.login.post({
          identifier, password,
        })
        if (error || status === 401 || status === 403) return false
        const payload = data as unknown as { user: AuthUser; token: { accessToken: string; refreshToken: string } }
        set({
          user: payload.user,
          accessToken: payload.token.accessToken,
          refreshToken: payload.token.refreshToken,
        })
        // 登录后拉取权限编号（失败不阻塞，perms 保持空数组）
        fetchUserPerms(payload.token.accessToken).then((perms) =>
          set({ perms })
        )
        return true
      },
      register: async (username, password) => {
        const { data, error, status } =
          await client.system.auth.register.post({
            username, password,
          })
        if (error || status === 409) return false
        const payload = data as unknown as { user: AuthUser; token: { accessToken: string; refreshToken: string } }
        set({
          user: payload.user,
          accessToken: payload.token.accessToken,
          refreshToken: payload.token.refreshToken,
        })
        fetchUserPerms(payload.token.accessToken).then((perms) =>
          set({ perms })
        )
        return true
      },
      refresh: async () => {
        const rt = useAuthStore.getState().refreshToken
        if (!rt) return false
        const { data, error, status } =
          await client.system.auth.refresh.post({
            refreshToken: rt,
          })
        if (error || status === 401) return false
        const payload = data as unknown as { user: { id: number; username: string }; token: { accessToken: string; refreshToken: string } }
        set({
          user: payload.user,
          accessToken: payload.token.accessToken,
          refreshToken: payload.token.refreshToken,
        })
        fetchUserPerms(payload.token.accessToken).then((perms) =>
          set({ perms })
        )
        return true
      },
      fetchPerms: async () => {
        const token = useAuthStore.getState().accessToken
        if (!token) return
        const perms = await fetchUserPerms(token)
        set({ perms })
      },
      logout: async () => {
        const rt = useAuthStore.getState().refreshToken
        if (rt) {
          await client.system.auth.logout.post({
            refreshToken: rt,
          })
        }
        set({ user: null, accessToken: null, refreshToken: null, perms: [] })
      },
    }),
    {
      name: STORAGE_KEYS.auth,
      // IndexedDB 异步适配器；水合由 AppBoot 统一触发
      storage: createJSONStorage(() => storageAdapter),
      skipHydration: true,
      // 每次加载都收敛一遍，挡住手改存储塞进来的半残登录态
      merge: (persisted, current) => ({
        ...current,
        ...readAuthData(persisted),
      }),
    }
  )
)
