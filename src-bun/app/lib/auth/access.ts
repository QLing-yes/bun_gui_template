import { db } from "@/app/model/sqlite/db";
import { AUTH_CACHE_LIMIT, AUTH_CACHE_TTL } from "@/config/auth";
import { AUTH } from "./config";

/** 登录用户的鉴权上下文（带缓存） */
export interface AuthContext {
  /** 用户 ID */
  userId: number;
  /** 登录名 */
  username: string;
  /** 是否超级管理员（代码短路放行全部接口） */
  isSuper: boolean;
  /** 接口权限编号集合 */
  perms: Set<number>;
}

/** 账号资料 + 鉴权信息（/system/auth/me 一次查询取全） */
export interface AccountInfo {
  /** 用户资料（含角色，不含权限明细） */
  profile: {
    id: number;
    username: string;
    email: string | null;
    phone: string | null;
    nickname: string | null;
    avatar: string | null;
    status: number;
    lastLoginAt: number | null;
    createdAt: number;
    roles: { id: number; code: string; name: string; level: number }[];
  };
  /** 是否超级管理员 */
  isSuper: boolean;
  /** 接口权限编号 */
  perms: number[];
}

interface CacheEntry {
  /** 过期时间（毫秒时间戳） */
  expireAt: number;
  /** 进行中或已完成的查询，避免并发穿透 */
  pending: Promise<AuthContext | null>;
}

const cache = new Map<number, CacheEntry>();

/** 查询鉴权上下文（用户状态 + 启用角色 + 权限并集） */
async function loadAuthContext(userId: number): Promise<AuthContext | null> {
  const row = await db.query.user.findFirst({
    columns: { id: true, username: true, status: true },
    where: { id: userId },
    with: {
      roles: {
        columns: { code: true, status: true },
        with: { perms: { columns: { permCode: true } } },
      },
    },
  });
  if (!row || row.status !== 1) return null;

  const activeRoles = row.roles.filter((item) => item.status === 1);
  const perms = new Set<number>();
  for (const item of activeRoles) {
    for (const perm of item.perms) perms.add(perm.permCode);
  }
  return {
    userId: row.id,
    username: row.username,
    isSuper: activeRoles.some((item) => item.code === AUTH.superAdminCode),
    perms,
  };
}

/** 清理已过期的缓存条目 */
function sweepCache(now: number): void {
  if (cache.size < AUTH_CACHE_LIMIT) return;
  for (const [userId, entry] of cache) {
    if (entry.expireAt <= now) cache.delete(userId);
  }
}

/** 取鉴权上下文（带 TTL 缓存，用户/角色/权限变更后调用 invalidateAuthContext） */
export function resolveAuthContext(
  userId: number,
): Promise<AuthContext | null> {
  const now = Date.now();
  const hit = cache.get(userId);
  if (hit && hit.expireAt > now) return hit.pending;

  const pending = loadAuthContext(userId);
  cache.set(userId, { expireAt: now + AUTH_CACHE_TTL, pending });
  // 查询失败不缓存，下次请求重新加载
  pending.catch(() => cache.delete(userId));
  sweepCache(now);
  return pending;
}

/** 失效鉴权缓存：传 userId 只清单个用户，不传清全部 */
export function invalidateAuthContext(userId?: number): void {
  if (userId === undefined) cache.clear();
  else cache.delete(userId);
}

/** 判断上下文是否可访问某个权限编号 */
export function canAccess(ctx: AuthContext, permCode: number): boolean {
  return ctx.isSuper || ctx.perms.has(permCode);
}

/** 个人资料 + 角色 + 权限编号（一次查询完成，供 /system/auth/me 使用） */
export async function getAccountInfo(
  userId: number,
): Promise<AccountInfo | null> {
  const row = await db.query.user.findFirst({
    columns: {
      id: true,
      username: true,
      email: true,
      phone: true,
      nickname: true,
      avatar: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
    },
    where: { id: userId },
    with: {
      roles: {
        columns: { id: true, code: true, name: true, level: true },
        where: { status: 1 },
        with: { perms: { columns: { permCode: true } } },
      },
    },
  });
  if (!row) return null;

  const { roles, ...profile } = row;
  const perms = new Set<number>();
  for (const item of roles) {
    for (const perm of item.perms) perms.add(perm.permCode);
  }
  return {
    profile: {
      ...profile,
      roles: roles.map(({ id, code, name, level }) => ({
        id,
        code,
        name,
        level,
      })),
    },
    isSuper: roles.some((item) => item.code === AUTH.superAdminCode),
    perms: [...perms],
  };
}
