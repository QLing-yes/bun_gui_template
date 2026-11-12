import { ENV } from "@/config/env";

/** 认证配置：环境变量统一取 config/env.ts，默认值由 .env 提供 */
export const AUTH = {
  /** JWT 签名密钥 */
  secret: new TextEncoder().encode(ENV.JWT_SECRET),
  /** JWT 签发方 */
  issuer: ENV.JWT_ISSUER,
  /** JWT 受众 */
  audience: ENV.JWT_AUDIENCE,
  /** access token 有效期（秒） */
  accessTtl: ENV.JWT_ACCESS_TTL_SEC,
  /** refresh token 有效期（秒） */
  refreshTtl: ENV.JWT_REFRESH_TTL_SEC,
  /** 超级管理员角色标识 */
  superAdminCode: "super_admin",
  /** 普通用户角色标识（注册默认角色） */
  defaultRoleCode: "user",
  /** 注册时直接授予超级管理员的用户名（空=不授予） */
  bootstrapSuperAdmin: (ENV.AUTH_SUPER_ADMIN_USER ?? "").trim().toLowerCase(),
} as const;
