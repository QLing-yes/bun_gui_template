import { and, eq, isNull, lt } from "drizzle-orm";
import { db } from "@/app/model/sqlite/db";
import { AUTH_PRUNE_INTERVAL_MS } from "@/config/auth";
import { session, user } from "@/runtime/generated/model/sqlite";
import { AUTH } from "./config";
import { createRefreshToken, hashRefreshToken, signAccessToken } from "./token";

/** 登录用户的最小会话信息 */
export interface SessionMeta {
  /** 登录设备信息 */
  userAgent?: string | null;
  /** 登录 IP */
  ip?: string | null;
}

/** 签发凭据对所需的最小用户信息 */
export interface TokenUser {
  id: number;
  username: string;
}

/** 登录凭据对 */
export interface TokenPair {
  /** access token（JWT，放 Authorization: Bearer） */
  accessToken: string;
  /** refresh token（不透明串，仅用于换新） */
  refreshToken: string;
  /** access token 有效期（秒） */
  expiresIn: number;
  /** refresh token 过期时间（毫秒时间戳） */
  refreshExpiresAt: number;
}

/** 组装凭据对（access token 异步签发） */
async function issue(
  userInfo: TokenUser,
  refreshToken: string,
  refreshExpiresAt: number,
): Promise<TokenPair> {
  return {
    accessToken: await signAccessToken(userInfo),
    refreshToken,
    expiresIn: AUTH.accessTtl,
    refreshExpiresAt,
  };
}

let lastPruneAt = 0;

/** 清理已过期会话（每小时最多执行一次，避免会话表无限增长） */
function pruneExpiredSessions(now: number): void {
  if (now - lastPruneAt < AUTH_PRUNE_INTERVAL_MS) return;
  lastPruneAt = now;
  db.delete(session).where(lt(session.expiresAt, now)).run();
}

/** 新建会话并签发凭据对 */
export async function createSession(
  userInfo: TokenUser,
  meta: SessionMeta,
): Promise<TokenPair> {
  const now = Date.now();
  pruneExpiredSessions(now);
  const refreshToken = createRefreshToken();
  const refreshExpiresAt = now + AUTH.refreshTtl * 1000;
  db.insert(session)
    .values({
      userId: userInfo.id,
      tokenHash: hashRefreshToken(refreshToken),
      userAgent: meta.userAgent ?? null,
      ip: meta.ip ?? null,
      expiresAt: refreshExpiresAt,
      lastUsedAt: now,
      createdAt: now,
    })
    .run();
  return issue(userInfo, refreshToken, refreshExpiresAt);
}

/** 轮换结果 */
export interface RotateResult {
  /** 新的凭据对 */
  tokens: TokenPair;
  /** 会话所属用户 */
  user: TokenUser;
}

/** 用 refresh token 换新凭据对（旧会话立即撤销，一次一换） */
export async function rotateSession(
  rawToken: string,
  meta: SessionMeta,
): Promise<RotateResult | null> {
  const now = Date.now();
  const rows = await db
    .select({
      sessionId: session.id,
      sessionCreatedAt: session.createdAt,
      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt,
      userId: user.id,
      username: user.username,
      status: user.status,
      passwordChangedAt: user.passwordChangedAt,
    })
    .from(session)
    .innerJoin(user, eq(session.userId, user.id))
    .where(eq(session.tokenHash, hashRefreshToken(rawToken)))
    .limit(1);

  const row = rows[0];
  if (!row || row.revokedAt !== null || row.expiresAt <= now) return null;
  if (row.status !== 1) return null;
  // 改密后签发的旧会话一律失效
  if (row.sessionCreatedAt < row.passwordChangedAt) return null;

  const nextToken = createRefreshToken();
  const nextExpiresAt = now + AUTH.refreshTtl * 1000;
  // 条件撤销保证同一 refresh token 并发只成功一次，失败则视为已被使用
  const rotated = db.transaction((tx) => {
    const revoked = tx
      .update(session)
      .set({ revokedAt: now, lastUsedAt: now })
      .where(and(eq(session.id, row.sessionId), isNull(session.revokedAt)))
      .run();
    if (revoked.changes !== 1) return false;
    tx.insert(session)
      .values({
        userId: row.userId,
        tokenHash: hashRefreshToken(nextToken),
        userAgent: meta.userAgent ?? null,
        ip: meta.ip ?? null,
        expiresAt: nextExpiresAt,
        lastUsedAt: now,
        createdAt: now,
      })
      .run();
    return true;
  });
  if (!rotated) return null;

  return {
    tokens: await issue(
      { id: row.userId, username: row.username },
      nextToken,
      nextExpiresAt,
    ),
    user: { id: row.userId, username: row.username },
  };
}

/** 撤销单个会话（登出），返回是否命中 */
export function revokeSession(rawToken: string): boolean {
  const result = db
    .update(session)
    .set({ revokedAt: Date.now() })
    .where(eq(session.tokenHash, hashRefreshToken(rawToken)))
    .run();
  return result.changes > 0;
}

/** 撤销用户全部会话（强制下线 / 改密后调用） */
export function revokeUserSessions(userId: number): void {
  db.update(session)
    .set({ revokedAt: Date.now() })
    .where(eq(session.userId, userId))
    .run();
}
