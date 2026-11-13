# 自动维护 - 保证一致性

/README.md

# elysiajs 规则
注意elysiajs类型链路稳健不断链。

## 特别注意AOT模式下的问题：
参考: https://next.elysiajs.com/patterns/aot/

### 一句话总结
默认是 JIT(首次请求到来时才编译该路由), AOT 把每条路由 handler/schema 的编译搬到"构建期": 构建脚本会 dry-run 执行入口, 捕获路由注册并生成 manifest, 产物落在 dist/, 运行期直接命中已编译程序。
- 收益: 启动与首请求更快; 峰值内存更低(免去运行期编译的临时分配); 可裁剪未使用的 Elysia 模块(所有 schema 都可编译时可完全移除 TypeBox); 默认值合并预计算。
- 代价: 生成的代码会增大 bundle 体积与启动驻留内存。
- 构建脚本(Bun): `Bun.build({ entrypoints, outdir: 'dist', target: 'bun', plugins: [aot(entry, { target: 'bun' })] })`, 末尾必须 `process.exit(0)`(dry-run 已启动过服务); 运行 `bun dist/index.js`。`target` 必须与真实运行时一致(bun / node / workerd)。

### 本项目注意事项
1. 入口约定: AOT 编译"主 app"优先取 `app` 导出, 其次 `default` 导出, 再次入口唯一实例。本项目 `app/index.ts` 已 `export const app`; `app/cluster.ts` 只做进程管理、不导出实例, 因此 **AOT 指向** 恒为 `app/index.ts`, 打包 entrypoints 为双入口 `[cluster.ts, index.ts]`(产物 cluster.js 供宿主启动, index.js 为 worker/AOT 入口)。
2. 构建期会真实执行入口(dry-run): 数据库/Redis 连接、定时器、顶层 await、日志初始化都会在构建机跑一遍。外部服务初始化必须包在 `if (!inAotBuild()) { ... }`(`import { inAotBuild } from "elysia"`)。本项目 `app/common/init-global.ts` 经 `app/common/index.ts` 静态引入 drizzle/redis, 必须确认构建期不建连(惰性连接)。
3. 实例 name 必须静态、唯一, 且构建期与运行期取值完全一致: 禁止由环境变量或运行时计算派生。本项目插件/generated 路由已统一使用显式静态常量名(如 `app/plugins/macro.plug`、`generated:plug_0`), 禁止再引入 `String(counter.n)` 这类依赖模块加载顺序的派生名——顺序一旦变化 manifest 键就对不上, 运行期报 `has no AOT manifest` 或 `Mismatch fingerprint`。多 app 场景主 app 也必须命名, 且所有 name 互不重复。
4. 只有自己起服务的实例才需要从入口命名导出: 凡是调用 `.listen()`/`.handle()`/`.compile()`、读 `.fetch`、或 `.mount(x.fetch)`/`.mount(x.handle)` 的实例, 否则构建成功但运行期抛 `[elysia-aot] App "<name>" has no AOT manifest. Name and export it, .mount() ones too`。仅 `.use()` 组合的插件、以及 `.mount(普通函数)`(如 `auth.handler`)不需要导出。
5. cluster worker 入口随产物切换: `app/cluster.ts` 用 `workerEntry = index + (import.meta.path 以 .ts 结尾 ? ".ts" : ".js")` 拼同目录路径，源码运行派 index.ts、打包产物派 index.js；worker 用 `process.execPath` 启动(随包 bun 即包内运行时、dev 即系统 bun)，**禁止写死 `bun` 或 `${import.meta.dir}/index.ts`**(dist 里不存在，且 PATH 未必有 bun)。
6. 环境变量: `ELYSIA_AOT_BUILD` 由构建插件设置, 运行环境残留会抛 `Elysia AOT capture module is not activated.`, 部署前清理。
7. manifest 带 ABI 指纹: elysia 版本变更后必须重新构建, 不可复用旧 dist(否则 `Mismatch fingerprint`)。
8. `precompile: true` 是运行期选项: AOT 下命中 manifest 时复用已编译程序, 保留不冲突; 其实际收益需以启动/首请求实测为准。
9. 改动后必验清单: 构建产物能 `bun dist/index.js` 启动; `/openapi`、动态参数路由、校验错误响应正常; `CLUSTER_ENABLED=true` 多 worker 正常; 日志无 AOT 报错; 构建期无外部服务连接。

# 环境变量
- src-bun 模块内禁止直接读 `process.env` / `Bun.env`（构建期 define 注入的 `process.env.NODE_ENV` 字面量、宿主注入的 `TAURI_SIDECAR` 除外；后者在 `app/common/tauri_sidecar.ts` 直接读 `process.env`），统一从 `@/config/env` 的 `ENV` 读取；`config/env.ts` 只收 `.env` 里声明的变量，默认值只写在 `.env`，读取/校验/类型转换的通用逻辑放 `utils/env_handle.ts`。
- src-bun 之外的脚本（根 `scripts/` 等）按常规方式直接读 `process.env`，不反向依赖 src-bun 的 `ENV`。

# 控制器规则
- 目录即前缀: `app/controller/<组>/...` 子目录生成路由前缀; 主 app `strictPath: true`, 子目录内写 `.post("/")` 会得到带尾斜杠的 `/api/xxx/` 而 `/api/xxx` 404——单路由场景用平铺文件 + 显式相对路径(如 `api/chat.ctrl.ts` + `.post("chat")` → `/api/chat`)。
- 按业务用文件夹分类: 同一业务的多条路由收进同名子目录(如 `system/auth/auth.ctrl.ts` → `/system/auth/**`), 文件内路径只写相对段(`"login"`), 不重复目录名; 单路由业务仍用平铺文件。
- 路由注册由生成器维护 `runtime/generated/routes.ts`: dev 时 watch 自动重生成; 手动加路由后跑 `bun run gen`（纯代码生成，不触碰数据库；迁移走 `bun run db:generate[:postgresql|:sqlite]` / `db:migrate[...]`，缺省 mysql，迁移配置集中在 `config/drizzle/<方言>.ts`）。
- 流式/原生响应: handler 可直接返回 Web `Response`(SSE/UI 消息流通用), 不走 `$g.success` 信封; env 缺失等错误分支返回 `Response.json(..., { status })`。
