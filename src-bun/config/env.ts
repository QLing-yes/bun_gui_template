/**
 * 环境变量单一入口：键名与 `.env` 变量同名、大小写一致，bun 侧所有配置统一从这里读取。
 * 默认值一律写在根目录 `.env`（或独立运行时的 `src-bun/.env`），本文件不做业务兜底默认。
 * 读取/校验/类型转换的通用逻辑见 `utils/env_handle.ts`。
 */

import { flag, num, opt, optNum, str } from "../utils/env_handle";

export const ENV = {
  // ─── 运行环境 ───────────────────────────────────────────────────────────
  /** 运行环境标识（development / production，未设置时为空串） */
  get NODE_ENV(): string {
    return opt("NODE_ENV") ?? "";
  },
  /** 服务端口 */
  get PORT(): string {
    return str("PORT");
  },

  // ─── 服务开关与静态资源 ─────────────────────────────────────────────────
  /** 是否开启跨域 */
  get CORS_ENABLED(): boolean {
    return flag("CORS_ENABLED");
  },
  /** 是否开启 OpenAPI 文档 */
  get OPENAPI_ENABLED(): boolean {
    return flag("OPENAPI_ENABLED");
  },
  /** 是否开启静态资源服务 */
  get STATIC_ENABLED(): boolean {
    return flag("STATIC_ENABLED");
  },
  /** 静态资源目录（相对运行目录，开启静态资源时必填） */
  get STATIC_DIR(): string {
    return str("STATIC_DIR");
  },

  // ─── 代码生成 ───────────────────────────────────────────────────────────
  /** Eden API 类型树输出目录（相对运行目录，留空时跳过生成） */
  get GEN_API_OUT_DIR(): string | undefined {
    return opt("GEN_API_OUT_DIR");
  },

  // ─── 日志与集群 ─────────────────────────────────────────────────────────
  /** 日志是否同时输出到终端 */
  get LOG_STDOUT(): boolean {
    return flag("LOG_STDOUT");
  },
  /** 是否启用单机多进程集群 */
  get CLUSTER_ENABLED(): boolean {
    return flag("CLUSTER_ENABLED");
  },
  /** 集群 worker 数量（未配置时由调用方按 CPU 核心数决定） */
  get CLUSTER_WORKERS(): number | undefined {
    return optNum("CLUSTER_WORKERS");
  },

  // ─── 数据库 ─────────────────────────────────────────────────────────────
  /** SQLite 库文件路径 */
  get SQLITE_DATABASE_PATH(): string {
    return str("SQLITE_DATABASE_PATH");
  },
  /** MySQL 主机 */
  get MYSQL_DATABASE_HOST(): string {
    return str("MYSQL_DATABASE_HOST");
  },
  /** MySQL 端口 */
  get MYSQL_DATABASE_PORT(): number {
    return num("MYSQL_DATABASE_PORT");
  },
  /** MySQL 库名 */
  get MYSQL_DATABASE_NAME(): string {
    return str("MYSQL_DATABASE_NAME");
  },
  /** MySQL 用户 */
  get MYSQL_DATABASE_USER(): string {
    return str("MYSQL_DATABASE_USER");
  },
  /** MySQL 密码 */
  get MYSQL_DATABASE_PASSWORD(): string {
    return str("MYSQL_DATABASE_PASSWORD");
  },
  /** MySQL 连接串 */
  get MYSQL_DATABASE_URL(): string {
    return str("MYSQL_DATABASE_URL");
  },
  /** MySQL 连接池上限 */
  get MYSQL_DATABASE_POOL_LIMIT(): number {
    return num("MYSQL_DATABASE_POOL_LIMIT");
  },
  /** PostgreSQL 主机（可选） */
  get PG_DATABASE_HOST(): string | undefined {
    return opt("PG_DATABASE_HOST");
  },
  /** PostgreSQL 端口（可选） */
  get PG_DATABASE_PORT(): number | undefined {
    return optNum("PG_DATABASE_PORT");
  },
  /** PostgreSQL 库名（可选） */
  get PG_DATABASE_NAME(): string | undefined {
    return opt("PG_DATABASE_NAME");
  },
  /** PostgreSQL 用户（可选） */
  get PG_DATABASE_USER(): string | undefined {
    return opt("PG_DATABASE_USER");
  },
  /** PostgreSQL 密码（可选） */
  get PG_DATABASE_PASSWORD(): string | undefined {
    return opt("PG_DATABASE_PASSWORD");
  },
  /** PostgreSQL 连接串（可选，未配置时不建连） */
  get PG_DATABASE_URL(): string | undefined {
    return opt("PG_DATABASE_URL");
  },
  /** PostgreSQL 连接池上限 */
  get PG_DATABASE_POOL_LIMIT(): number | undefined {
    return optNum("PG_DATABASE_POOL_LIMIT");
  },
  /** Redis 连接串（可选） */
  get REDIS_URL(): string | undefined {
    return opt("REDIS_URL");
  },

  // ─── 认证 ───────────────────────────────────────────────────────────────
  /** JWT 签名密钥 */
  get JWT_SECRET(): string {
    return str("JWT_SECRET");
  },
  /** JWT 签发方 */
  get JWT_ISSUER(): string {
    return str("JWT_ISSUER");
  },
  /** JWT 受众 */
  get JWT_AUDIENCE(): string {
    return str("JWT_AUDIENCE");
  },
  /** access token 有效期（秒） */
  get JWT_ACCESS_TTL_SEC(): number {
    return num("JWT_ACCESS_TTL_SEC");
  },
  /** refresh token 有效期（秒） */
  get JWT_REFRESH_TTL_SEC(): number {
    return num("JWT_REFRESH_TTL_SEC");
  },
  /** 注册时直接授予超级管理员的用户名（可选） */
  get AUTH_SUPER_ADMIN_USER(): string | undefined {
    return opt("AUTH_SUPER_ADMIN_USER");
  },

  // ─── AI ────────────────────────────────────────────────────────────────
  /** OpenAI 兼容接口地址 */
  get AI_BASE_URL(): string | undefined {
    return opt("AI_BASE_URL");
  },
  /** AI 接口密钥 */
  get AI_API_KEY(): string | undefined {
    return opt("AI_API_KEY");
  },
  /** AI 模型名 */
  get AI_MODEL(): string | undefined {
    return opt("AI_MODEL");
  },
};
