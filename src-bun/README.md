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
│   │   ├── api/              # /api（chat、title、base）
│   │   ├── test/             # /test（框架响应测试 + mysql/postgresql/sqlite 方言测试）
│   │   └── offline/          # /offline（桌面专属，令牌校验）
│   ├── lib/
│   │   ├── error.ts          # 进程异常事件捕获记录 (同步模式)
│   │   ├── logger.ts         # 日志库 (默认异步模式)
│   │   ├── mysql/
│   │   │   └── index.ts      # MySQL 连接池 (mysql2)
│   │   ├── postgresql/
│   │   │   └── index.ts      # PostgreSQL 连接池 (Bun.SQL)
│   │   ├── sqlite/
│   │   │   └── index.ts      # SQLite 连接 (bun:sqlite)
│   │   └── redis/
│   │       └── index.ts      # Redis 客户端
│   ├── model/                # Drizzle 数据模型目录（按方言分目录，`.mold.ts` 导出的`schema`自动注册）
│   │   ├── describe.ts       # 字段描述注册表（`description(table)` 注入 OpenAPI）
│   │   ├── mysql/            # db.ts / relations.ts / *.mold.ts
│   │   ├── postgresql/       # db.ts / relations.ts / *.mold.ts
│   │   └── sqlite/           # db.ts / relations.ts / *.mold.ts
│   ├── plugins/
│   │   ├── index.plug.ts     # 全局插件
│   │   └── macro.plug.ts     # 宏插件
│   │   └── controller.plug.ts # 控制器插件
│   │   └── schemas.plug.ts   # 数据模型注册插件
│   ├── utils/                # 工具函数
│   └── cluster.ts            # 单机多进程集群模式入口（仅Linux生效）
│   └── index.ts              # 应用入口
├── logs/
├── test/                     # Eden 测试目录
├── system/                  # 辅助脚本与派生产物
│   ├── script/
│   │   ├── index.ts          # 生成脚本
│   │   ├── menu.ts           # 交互式命令菜单
│   │   ├── routes.ts         # 路由 生成工具
│   │   └── batchExport.ts    # 批量导出文件 生成工具
│   └── generated/            # 派生产物（勿手改）：routes.ts、model/schema.ts、model/<方言>/index.ts、drizzle/<方言>/
|── .env                      # 配置文件
|── drizzle.config.<方言>.ts  # drizzle 迁移配置（每方言一份：mysql / postgresql / sqlite）
...
```

### 请按以下步骤配置 Drizzle

1. **检查数据库配置** — 确认 [.env](.env) 中的数据库连接信息是否正确
2. **确认数据模型** — 检查 [app/model](app/model) 中的模型定义是否符合需求
3. **同步到数据库** — 运行 `bun run db:generate` 生成迁移文件，再运行 `bun run db:migrate` 执行

> 多数据库（已内置 mysql / postgresql / sqlite 最简示例 user/post）：运行时每种方言在 `app/lib/<方言>` 各自建连，分别读自己的连接串（`MYSQL_DATABASE_URL` / `PG_DATABASE_URL` / `SQLITE_DATABASE_PATH`），不要合并成一个变量；SQLite 路径**没有默认值**，必须由 `SQLITE_DATABASE_PATH` 提供（如 `./data/sqlite/app.db`）。迁移侧 drizzle-kit 每种方言一份 `drizzle.config.<方言>.ts`（schema 指向 `app/model/<方言>`，产物在 `system/generated/drizzle/<方言>`），用 `bun run db:generate:postgresql` / `bun run db:generate:sqlite`（mysql 为默认的 `db:generate`）指定方言。新增方言只需建 `app/model/<方言>` 与对应 config，表聚合会自动生成。

## 环境变量

- 统一放在仓库根目录 `.env`（mysql / PostgreSQL / SQLite / Redis / AI 配置）。
- bun 只自动加载**当前工作目录**的 `.env`；从 `src-bun` 直接启动时用 `bun --env-file=../.env run dev`，或把 `.env` 放到 `src-bun`。
- Tauri 桌面打包态由服务目录 `dist/bun/.env` 提供，无需额外参数。

## 测试接口

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/test/{mysql,postgresql,sqlite}/user` | 创建用户 |
| POST | `/test/{mysql,postgresql,sqlite}/post` | 创建文章（authorId 关联用户） |
| GET | `/test/{mysql,postgresql,sqlite}/user` | 用户及文章列表（验证关系） |
| POST | `/test/*` | 框架响应 / 异常测试 |

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

bun run gen       # 手动生成：路由、模型注册表、表聚合、eden API 类型树（一般无需手动）
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
  /** 日志输出目录，默认 `logs` */
  dir?: string;
  /** 文件轮转粒度，默认 `day` */
  rotateBy?: RotateBy;
  /** 是否同时输出到 stdout，默认 `process.env.LOG_STDOUT` */
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
