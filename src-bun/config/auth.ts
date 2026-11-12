/**
 * 认证运行参数：权限缓存与过期会话清理策略。
 * 只放与部署规模相关的调优常量；角色标识、JWT 取值等语义/环境配置仍在原模块。
 */

/** 用户权限缓存有效期（毫秒） */
export const AUTH_CACHE_TTL = 30_000;

/** 权限缓存条目上限（超过时顺带清理过期项） */
export const AUTH_CACHE_LIMIT = 500;

/** 过期会话清理间隔（毫秒） */
export const AUTH_PRUNE_INTERVAL_MS = 60 * 60 * 1000;
