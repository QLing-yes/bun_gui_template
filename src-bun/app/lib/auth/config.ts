/** 认证配置：全部取自环境变量，缺省值只保证开发可跑 */
const env = process.env;

/** access token 默认有效期（秒） */
const ACCESS_TTL_SEC = Number(env.JWT_ACCESS_TTL_SEC) || 900;

/** refresh token 默认有效期（秒，30 天） */
const REFRESH_TTL_SEC = Number(env.JWT_REFRESH_TTL_SEC) || 2_592_000;

export const AUTH = {
  /** JWT 签名密钥 */
  secret: new TextEncoder().encode(
    env.JWT_SECRET || "dev-only-insecure-secret",
  ),
  /** JWT 签发方 */
  issuer: env.JWT_ISSUER || "aigc",
  /** JWT 受众 */
  audience: env.JWT_AUDIENCE || "aigc-web",
  /** access token 有效期（秒） */
  accessTtl: ACCESS_TTL_SEC,
  /** refresh token 有效期（秒） */
  refreshTtl: REFRESH_TTL_SEC,
  /** 超级管理员角色标识 */
  superAdminCode: "super_admin",
  /** 普通用户角色标识（注册默认角色） */
  defaultRoleCode: "user",
  /** 用户权限缓存有效期（毫秒） */
  cacheTtl: 30_000,
  /** 注册时直接授予超级管理员的用户名（空=不授予） */
  bootstrapSuperAdmin: (env.AUTH_SUPER_ADMIN_USER || "").trim().toLowerCase(),
} as const;
