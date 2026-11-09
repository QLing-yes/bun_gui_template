// 权限判定单源（占位实现）：路由元数据声明所需权限，菜单可用性与页面准入都走 useAccess/canAccessWith。
// 当前仓库没有角色/权限体系：权限来源暂按登录用户名查 PLACEHOLDER_GRANTS（占位来源，不是真实鉴权）；
// 未声明权限的路由默认放行，因此接入本链路不改变现有页面行为。
// 正式接入时只需替换 permissionsOf()（currentPermissions 与 useAccess 共用它），路由声明与两侧调用方都不用动。

import { useCallback } from "react"

import { useAuthStore } from "@/store/auth"

/** 路由所需权限声明（挂在 routes/registry 的 handle.access 上） */
export type RouteAccess = {
  /** 权限标识（与真实权限系统的编码对齐） */
  permission: string
  /** 展示用权限名（权限或角色的中文说明，供空状态与菜单提示） */
  label: string
  /** 演示项标记：无权限空状态额外展示「如何解除」提示 */
  demo?: boolean
}

/** 未登录时的占位账号键 */
const GUEST_KEY = "guest"

/**
 * 占位授权表（真实角色/权限体系接入前使用）：用户名 → 权限集合
 * 权限集合里的 "*" 表示全部放行；未登录按 GUEST_KEY 查
 * 演示项解除：给当前用户名（未登录用 guest）追加 "demo:restricted" 或 "*"
 */
const PLACEHOLDER_GRANTS: Record<string, readonly string[]> = {
  // guest: ["demo:restricted"],
}

/** 当前用户具名权限（占位来源：auth store 用户名 + 上表；替换此函数即接入真实鉴权） */
export function currentPermissions(): readonly string[] {
  return permissionsOf(useAuthStore.getState().username)
}

/**
 * 按用户名取占位权限集合
 * @param username 当前用户名（null = 未登录）
 */
export function permissionsOf(username: string | null): readonly string[] {
  return PLACEHOLDER_GRANTS[username ?? GUEST_KEY] ?? []
}

/**
 * 纯判定：权限声明 + 权限集合 → 是否放行（未声明权限即放行）
 * @param access 路由权限声明 @param owned 当前账号权限集合
 */
export function canAccessWith(
  access: RouteAccess | undefined,
  owned: readonly string[]
): boolean {
  if (!access) return true
  return owned.includes("*") || owned.includes(access.permission)
}

/**
 * 响应式权限判定入口（菜单/页面槽用）：账号变化会重算，判定逻辑仍只有 canAccessWith 一份
 * @returns 判定函数（传路由权限声明，返回是否放行）
 */
export function useAccess() {
  const username = useAuthStore((s) => s.username)
  return useCallback(
    (access?: RouteAccess) => canAccessWith(access, permissionsOf(username)),
    [username]
  )
}
