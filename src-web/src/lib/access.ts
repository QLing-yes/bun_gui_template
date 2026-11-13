// 权限判定单源：路由元数据声明所需权限编号，菜单可用性与页面准入都走 useAccess/canAccessWith。
// 权限来源：auth store 的 perms（登录后从 /system/auth/me 拉取）；未登录或无权限时路由默认放行（未声明 access 的页）。

import { useCallback } from "react"

import { useAuthStore } from "@/store/auth"

/** 路由所需权限声明（挂在 routes/registry 的 handle.access 上） */
export type RouteAccess = {
  /** 权限编号（与后端 role_permission.perm_code 对齐） */
  permission: number
  /** 展示用权限名（权限或角色的中文说明，供空状态与菜单提示） */
  label: string
  /** 演示项标记：无权限空状态额外展示「如何解除」提示 */
  demo?: boolean
}

/** 当前用户权限编号集合（未登录或拉取失败为空数组） */
export function currentPermissions(): readonly number[] {
  return useAuthStore.getState().perms
}

/**
 * 纯判定：权限声明 + 权限编号集合 → 是否放行（未声明权限即放行）
 * @param access 路由权限声明 @param owned 当前账号权限编号集合
 */
export function canAccessWith(
  access: RouteAccess | undefined,
  owned: readonly number[]
): boolean {
  if (!access) return true
  return owned.includes(access.permission)
}

/**
 * 响应式权限判定入口（菜单/页面槽用）：perms 变化会重算，判定逻辑仍只有 canAccessWith 一份
 * @returns 判定函数（传路由权限声明，返回是否放行）
 */
export function useAccess() {
  const perms = useAuthStore((s) => s.perms)
  return useCallback(
    (access?: RouteAccess) => canAccessWith(access, perms),
    [perms]
  )
}
