[English](./README-en.md) | [中文](./README.md)

## 预发布版本 `0.9.9`

- `1.0.0` 版本起即为正式版
- 克隆项目尝鲜体验

## 项目结构
- 全自动路由、日志系统、ORM、端到端类型安全，更多功能即将推出
- 你配置好一切到达理想状态时，只需关注 `controller` 即可

```
Project/
├── public/                   # 静态资源（自动路由）
├── app/
│   ├── common/
│   │   └── index.ts          # 全局模块 (注册到全局`$g`, 仅`controller`中使用)
│   │   └── schemas.ts        # 数据模型 (这里导出的模型都将使用`elysia.model()`注册)
│   │   └── schemaDerive.ts   # 数据模型的派生类型和方法
│   ├── controller/           # 控制器层（目录即路由前缀，`ctrl.ts` 结尾自动注册）
│   │   ├── api/              # /api（公共路由）
│   │   ├── system/           # /system（本系统专用）
│   │   ├── test/             # /test（测试用）
│   │   ├── offline/          # /offline（离线专属，只能在用户客户端使用的路由）
│   │   └── ...
│   ├── lib/
│   │   ├── error.ts          # 进程异常事件捕获记录 (同步模式)
│   │   ├── logger.ts         # 日志库 (默认异步模式)
│   │   ├── mysql/
│   │   │   └── index.ts      # MySQL 连接池 (mysql2)
│   │   ├── postgresql/
│   │   │   └── index.ts      # PostgreSQL 连接池 (Bun.SQL)
│   │   ├── sqlite/
│   │   │   └── index.ts      # SQLite 连接 (bun:sqlite)
│   │   ├── redis/
│   │   │   └── index.ts      # Redis 客户端
│   │   └── auth/             # 认证：JWT、密码哈希、会话、权限缓存、内置角色
│   ├── model/                # Drizzle 数据模型目录（按方言分目录，`.mold.ts` 导出的`schema`自动注册）
│   │   ├── describe.ts       # 字段描述注册表（`description(table)` 注入 OpenAPI）
│   │   ├── mysql/            # db.ts / relations.ts / *.mold.ts
│   │   ├── postgresql/       # db.ts / relations.ts / *.mold.ts
│   │   └── sqlite/           # db.ts / relations.ts / *.mold.ts
│   ├── plugins/
│   │   ├── index.plug.ts     # 全局插件
│   │   ├── controller.plug.ts # 控制器插件
│   │   ├── macro.plug.ts     # 宏插件
│   │   ├── schemas.plug.ts   # 数据模型注册插件
│   │   └── auth.plug.ts      # 登录态与接口权限插件
│   ├── cluster.ts            # 单机多进程集群模式入口（仅Linux生效）
│   └── index.ts              # 应用入口
├── utils/                    # 通用工具（独立于 app，根构建脚本也复用）
│   └── generate/             # 代码生成工具（routes / batchExport / genApiTypes）
├── config/                   # 集中配置（按文件分类）
│   ├── env.ts                # 环境变量统一入口（ENV，默认值来自 .env）
│   ├── auth.ts               # 认证运行参数（权限缓存 TTL/上限、会话清理间隔）
│   ├── bunfig.toml           # Bun 运行/安装配置（脚本用 --config 指定）
│   ├── biome/
│   │   └── biome.jsonc       # 代码检查与格式化（fix 用 --config-path 指定）
│   └── drizzle/              # 迁移配置（mysql / postgresql / sqlite 各一份）
├── runtime/                  # 运行期产物（不入库，除 generated 外）
│   ├── generated/            # 派生产物（勿手改）：routes.ts、model/schema.ts、model/<方言>/index.ts、drizzle/<方言>/
│   ├── database/             # 运行期数据（SQLite 库文件，路径取 SQLITE_DATABASE_PATH）
│   └── logs/                 # 运行日志
├── system/                   # 脚本与类型声明
│   ├── script/               # 命令与构建入口
│   │   ├── index.ts          # 生成入口（调度 utils/generate）
│   │   ├── menu.ts           # 交互式命令菜单
│   │   ├── build.ts          # Bun 构建
│   │   └── build_tauri_bun.ts # 本地服务产物
│   └── types/                # global.d.ts（$g 全局声明）
|── .env                      # 配置文件
...
```

> 配置集中在 `config/`。`tsconfig.json`、`.npmrc`、`.gitignore` 因工具固定从包根读取（无路径参数）保留在包根；`bun` 命令需带 `--config=./config/bunfig.toml`（package.json 脚本已内置），手动 `bun add` / `bun install` 同理。

## 独立运行（单独拷出 src-bun）

1. 把仓库根 `.env` 复制为 `src-bun/.env`（bun 只自动读取当前工作目录的 `.env`）。
2. `bun install` 后直接 `bun run dev`；所有脚本已内置 `--config=./config/bunfig.toml`。
3. `bun run gen` 在未配置 `GEN_API_OUT_DIR` 时跳过 Eden 类型树，路由与模型产物照常生成（独立运行把该变量留空即可）。
4. `bun run db:migrate:sqlite` 会自动创建库文件所在目录（如 `./runtime/database/sqlite`），首次即可直接迁移。

- 数据库操作集中在 `sqlite` 模块，如需要使用到其他数据库可以让AI帮助迁移数据模型（非常简单）。

### 请按以下步骤配置 Drizzle

1. **检查数据库配置** — 确认 [.env](.env) 中的数据库连接信息是否正确
2. **确认数据模型** — 检查 [app/model](app/model) 中的模型定义是否符合需求
3. **同步到数据库** — MySQL：`bun run db:generate` + `bun run db:migrate`；SQLite（认证表所在）：`bun --env-file=../.env run db:generate:sqlite` + `bun --env-file=../.env run db:migrate:sqlite`

> 多数据库（已内置 mysql / postgresql / sqlite 最简示例 user/post）：运行时每种方言在 `app/lib/<方言>` 各自建连，分别读自己的连接串（`MYSQL_DATABASE_URL` / `PG_DATABASE_URL` / `SQLITE_DATABASE_PATH`），不要合并成一个变量；SQLite 路径**没有默认值**，必须由 `SQLITE_DATABASE_PATH` 提供（如 `./runtime/database/sqlite/app.db`）。迁移侧 drizzle-kit 每种方言一份 `config/drizzle/<方言>.ts`（schema 指向 `app/model/<方言>`，产物在 `runtime/generated/drizzle/<方言>`），用 `bun run db:generate:postgresql` / `bun run db:generate:sqlite`（mysql 为默认的 `db:generate`）指定方言。新增方言只需建 `app/model/<方言>` 与 `config/drizzle/<方言>.ts`，表聚合会自动生成。

## 环境变量

- 统一放在仓库根目录 `.env`（mysql / PostgreSQL / SQLite / Redis / AI / 认证配置）。
- src-bun 内统一从 `config/env.ts` 的 `ENV` 读取（不直接读 `process.env` / `Bun.env`），键名与 `.env` 变量同名同大小写（如 `ENV.STATIC_DIR`）；src-bun 之外的根脚本（如 `scripts/config.ts`、`scripts/round_icons.ts`）按常规直接读 `process.env`。默认值只写在 `.env`，必填项缺失会直接报错。
- 静态资源：`STATIC_ENABLED` 开关、`STATIC_DIR` 指定目录（必填、无默认值，相对运行目录，构建时同步复制到产物）。
- 代码生成：`GEN_API_OUT_DIR` 指定 Eden API 类型树输出目录（相对运行目录；留空则 `bun run gen` 跳过该步）。
- 认证相关：`JWT_SECRET`（必改）、`JWT_ISSUER`、`JWT_AUDIENCE`、`JWT_ACCESS_TTL_SEC`、`JWT_REFRESH_TTL_SEC`、`AUTH_SUPER_ADMIN_USER`（注册时直接授予超管的用户名，留空不授予）。
- 环境判断：`TAURI_SIDECAR` 由桌面宿主注入、不属于 `.env`，直接在 `app/common/tauri_sidecar.ts` 读 `process.env`（`ENV` 中不收录）。
- bun 只自动加载**当前工作目录**的 `.env`；从 `src-bun` 直接启动时用 `bun --env-file=../.env run dev`，或把 `.env` 放到 `src-bun`（`db:migrate:*` 同理需要 `--env-file=../.env`）。
- Tauri 桌面打包态由服务目录 `dist/bun/.env` 提供，无需额外参数。

## 测试接口

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/test/{mysql,postgresql,sqlite}/user` | 创建用户 |
| POST | `/test/{mysql,postgresql,sqlite}/post` | 创建文章（authorId 关联用户） |
| GET | `/test/{mysql,postgresql,sqlite}/user` | 用户及文章列表（验证关系） |
| POST | `/test/*` | 框架响应 / 异常测试 |

## 系统接口（/system）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/system/ready` | 服务就绪探针 |
| POST | `/system/all_perm` | 权限编号 → 路由签名 |
| POST | `/system/auth/orphan_perm` | 孤儿权限编号清单（数据库已绑定、当前路由不存在，升序） |
| POST | `/system/auth/register` | 注册：用户名必填，邮箱/手机号可选；返回 access + refresh |
| POST | `/system/auth/login` | 用户名 / 邮箱 / 手机号 + 密码登录 |
| POST | `/system/auth/refresh` | 用 refresh token 换新凭据（旧会话立即撤销） |
| POST | `/system/auth/logout` | 撤销 refresh token 对应会话 |
| GET | `/system/auth/me` | 当前登录用户资料、角色与权限编号 |

- 受保护接口在路由选项声明 `perm(编号)`，请求头带 `Authorization: Bearer <accessToken>`；未声明编号的接口公开。
- 超级管理员（`super_admin`）短路放行；其余按角色绑定的 `role_permission.perm_code` 校验，用户权限缓存 30 秒。
- 内置角色在首次注册时自动写入：超级管理员(`super_admin`) / 管理员(`admin`) / 普通用户(`user`)，注册默认分配 `user`。
- 表结构：`user` / `role` / `user_role` / `role_permission` / `session`，迁移产物在 `runtime/generated/drizzle/sqlite`。

## 快速开始

```bash
bun i
bun run dev
```

## 命令

```bash
bun run menu    # 启动交互式菜单
bun run dev     # 启动开发服务器、自动生成路由
bun run start-hot # 以正式环境启动，支持热更新
bun run start-hot-bg # 以正式环境启动，支持热更新，关闭终端不终止进程
bun run fix     # 修复代码风格

bun run gen       # 手动生成：路由、模型注册表、表聚合、eden API 类型树（在 src-bun 内直接跑需 --env-file=../.env，否则按未配置 GEN_API_OUT_DIR 跳过类型树）
bun run gen:watch # 同上，持续监听变更（dev 已内置）

bun run db:generate # 仅生成迁移文件
bun run db:migrate  # 执行已生成的迁移
bun run db:studio   # drizzle 可视化
# 其它方言：在上述命令后加 :postgresql 或 :sqlite，如 bun run db:generate:sqlite

```
- `bun run menu --list` 列出所有选项
- `bun run menu <父级> <子项> <...>` 支持按路径逐级定位执行

## 日志配置

- 默认：[应用使用`同步`模式记录](app/lib/error.ts)，[控制器使用`异步`记录的方式](app/plugins/controller.plug.ts)。

```typescript
import { Logger, logger } from "@/app/lib/logger";
//const logger = new Logger({ sync: false, level: "debug" });
logger.info("msg", { meta: "value" });
logger.error("msg", Object | Error);
```

[logger.ts](app/lib/logger.ts)

```typescript
/** 日志级别 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/** 文件轮转粒度 */
export type RotateBy = "hour" | "day" | "month";

/** 日志元数据类型 */
export type Meta = Record<string, unknown> | Error | undefined | null;

/** Logger 构造选项 */
export interface LoggerOptions {
  /** 日志输出目录，默认 `runtime/logs` */
  dir?: string;
  /** 文件轮转粒度，默认 `day` */
  rotateBy?: RotateBy;
  /** 是否同时输出到 stdout，默认取 `ENV.LOG_STDOUT` */
  stdout?: boolean;
  /** 最低记录级别，默认 `debug` */
  level?: LogLevel;
  /** 定时刷新间隔（ms），默认 `1000` */
  flushInterval?: number;
  /**
   * 内存缓冲高水位线（字节），达到后同步落盘，默认 `1MB`
   * 适用于 async 模式；sync 模式每次写入直接落盘，此选项无效
   */
  highWaterMark?: number;
  /** 保留归档文件的最大数量，0 表示不限制，默认 `0` */
  maxFiles?: number;
  /** 同步写入模式，默认 `false` */
  sync?: boolean;
  /** 格式化元数据的缩进空格数，默认 `1` */
  formatted?: number;
}
```
