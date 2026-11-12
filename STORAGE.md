# STORAGE —— 数据存在哪、凭什么规则写

> 本文件只回答两件事：本地数据存在哪、按什么规则读写。目录职责见 `STRUCTURE.md`，规则条款见根 `AGENTS.md` 与 `src-web/AGENTS.md`。本文只补这些文档没有的实现事实，不重复陈述。
> 代码事实以 `src-web/src/lib/storage.ts` 为唯一准绳；本文与代码冲突时以代码为准并修本文。

## 1. 真值分层

| 层 | 载体 | 权威范围 |
|---|---|---|
| 界面真值 | zustand store：`store/ui.ts`、`store/auth.ts` | 界面读到的一切业务/偏好状态；持久化只是把 store 载荷序列化后落盘 |
| 持久化真值 | 内存镜像 `cache`（`lib/storage.ts`） | 持久化层的读写语义；读 API 只认它 |
| 落盘副本 | IndexedDB 库 `aigc-web` 的 `records` 表 | 耐久副本；可由内存镜像覆盖，也可能落后于内存 |

- **读永远读内存，不等库确认**：`readText` 只 `await initStorage()`（仅首次等打开/迁移/导入/装载），随后直接返回 `cache` 里的值；`writeText` 先把新值写进 `cache` 与待落库队列，再按键防抖批量落库，调用方不必等事务提交。
- 内存可能比库新：写入后、flush 前，读到的就是内存新值；`bootStorage` 装载时还会用 `pendingPut`/`pendingDelete` 覆盖库里的旧值，避免重试启动时用户刚改的值跳变。
- 后果：
  - 界面响应不被磁盘 IO 拖住；数据库故障时应用仍可交互，只降级为 `pending/error` 并保留内存数据（见 §5）。
  - 强杀/崩溃会丢失尚未 flush 的写；`pagehide` 与 `visibilitychange(hidden)` 只缩短丢失窗口，不构成保证。
  - 跨窗口只能看到对方「已落库并广播」后的值，看不到对方内存里的待落库值（见 §4）。
  - 不得用「库里有什么」推断业务状态；库是副本，界面只认 store。
- **不要把内存镜像叫缓存**（内存镜像是持久化层的真源，只有可由它重建的副本才算缓存）。本仓库真正可重建的缓存只有：
  - `lib/tauri` 的 sidecar 令牌 Promise 缓存：只缓存非空结果，`sidecar-terminated` 时清空后可经 IPC 重取。
  - `routes/pages/settings.tsx` 的 `rawRef`：已装载分栏布局原文的运行时镜像，可从持久化记录重建。
  - 路由槽保活的组件状态与滚动位置：纯内存态，不落盘、重建即默认值。

## 2. 客户端存储

- 库：Dexie 4（`src-web/package.json` 的 `dexie`），只被 `lib/storage.ts` 引入。
- **一张表**：`records`；库名 `aigc-web`，`SCHEMA_VERSION = 1`，Dexie schema 串为 `"key, updatedAt, dirty"`。
  - 主键：`key`。
  - 索引：`updatedAt`、`dirty`（当前只为将来同步预留，运行期无查询使用）。
  - 两条元数据记录也放在同一表（`__schema_version`、`__legacy_imported`，均 `dirty=0`），没有独立元数据表。
- 记录字段（`StoredRecord`）：

| 字段 | 类型 | 含义 |
|---|---|---|
| `key` | `string` | 逻辑键；沿用旧 localStorage 键名，便于一次性导入与排障 |
| `value` | `string` | 原始字符串；zustand 载荷是 JSON 串，主题是裸枚举值，第三方库是自己的原文 |
| `updatedAt` | `number` | 内容更新时间（ms）；每次 flush 时统一取 `Date.now()`，为将来按时间增量挑数据预留 |
| `dirty` | `0 \| 1` | 脏标记：`1`=本地有未同步变更，`0`=已同步基线；当前无同步服务，所有新写与历史导入一律 `1`，仅元数据记录写 `0` |

- 逻辑键登记表（`STORAGE_KEYS` 与派生键；值一经发布不可改）：

| 逻辑键 | 实际落盘键 | 值形态 | 写入方 | 防抖 |
|---|---|---|---|---|
| `aigc-ui` | 同名 | zustand UI 载荷 JSON（`state` + `version: 4`） | `store/ui.ts` 经 `storageAdapter` | 400ms |
| `aigc-auth` | 同名 | zustand 鉴权载荷 JSON（仅 `username`） | `store/auth.ts` 经 `storageAdapter` | 0ms（即时） |
| `theme` | 同名 | 裸字符串 `light`/`dark`/`system` | `components/theme-provider.tsx` | 0ms（即时） |
| `aigc-settings-split` | `react-resizable-panels:aigc-settings-split`（`SETTINGS_LAYOUT_KEY`） | `react-resizable-panels` 的布局原文 | `routes/pages/settings.tsx` | 400ms |
| `dlx:pos` | 同名 | 检视器位置原文 | `dev/layer-inspector.ts`（宿主注入 `readText`/`writeText`） | 0ms（即时） |
| 未登记键 | 同名 | 任意字符串 | 任意门面调用方 | 默认 300ms |

- 防抖分层（`DEBOUNCE_BY_KEY`）：0ms=即时档，400ms=中频偏好，未登记走默认 300ms；同一键窗口期内只保留最后一次值。`removeText` 不受防抖表约束，删除一律立即 flush。`writeText` 的 `{ immediate: true }` 可跳防抖，但当前仓库调用方均未显式使用，即时档实际由 0ms 登记决定。
- 高频连续值（拖拽中的坐标、尺寸等）不得逐帧写：由调用方在提交时机（如 pointerup / `onValueCommitted`）写一次，门面不再做节流。
- 追加型数据（消息等）应按单条逻辑键入表增量写，禁止每次改动整包重写数组（`storage.ts` 头部约束）。
- 批量提交（`flushStorage` → `doFlush`）：
  - 取当前 `pendingPut`/`pendingDelete` 快照并清空队列，置 `saving`。
  - 一次 `db.transaction("rw", db.records)` 内 `bulkPut` + `bulkDelete`；所有 put 共用同一个 `updatedAt`，`dirty=1`。
  - 成功后 `resetRetry`、按剩余队列如实置 `idle`/`pending`，再广播本次键；提交期间有新写则 `flushAgain` 收尾后立刻再排空一次。
  - 失败 `requeue` 回队列（只补未被更新值覆盖的键），置 `error` 并按 §5 退避。
- flush 触发时机：单键防抖定时器到点；`removeText`；`pagehide`；`visibilitychange` 且 `visibilityState === "hidden"`（仅在 `initStorage` 已启动后）；重试定时器；调用方显式 `flushStorage()`（`usePersistedValue.retry` 会用它补推待落库数据）。
- zustand 接入：两个 store 都用 `createJSONStorage(() => storageAdapter)` + `skipHydration: true`，由 `components/app-boot.tsx` 在库装载完成后统一 `persist.rehydrate()`；`ui` 载荷 `version: 4` 且 `migrate`/`merge` 共用同一收敛函数，`auth` 只有 `merge`（无版本号）。

## 3. 迁移与首次导入

- 历史导入（legacy import）：
  - 扫描 `localStorage` 的所有键（除标记键），逐个读出，组装为 `dirty=1` 记录，`updatedAt` 取本次时间。
  - 数据与标记键 `__legacy_imported` 在**同一事务**写入，标记随之原子提交；随后逐个 `removeItem` 清理原键。
  - 读取/清理失败只计数并写 DEV 日志，不中断启动。
- 幂等要求：
  - 有 `__legacy_imported` 即跳过，重复启动不会二次搬迁。
  - 事务失败则整体回滚、不写标记，下次启动自动重试；清理失败会留下旧键，但标记已存在，不会重导。
  - 导入会连第三方库自管的键一起搬（键名不改），之后仍按下表规则只登记、不接管。
- 归一化（每次启动都跑，幂等）：`migrateRecordsToLatest` 只挑 `dirty` 非 0/1 或 `updatedAt` 非有限数的记录，在一次事务内补成合法值；不删除、不重写合法记录。
- schema 版本：`bootStorage` 读 `__schema_version` 与 `db.verno` 比对，不一致只写一条元数据并打日志，不触发数据改写。
- 版本升级写法约束：
  - 新增表/索引时抬 `SCHEMA_VERSION` 并加 `this.version(n).stores(...)`；升级由 Dexie 版本驱动。
  - **不写逐版数据迁移脚本**；数据形态变化走 `migrateRecordsToLatest` 的幂等归一，从任意旧形态一步收敛到最新。
  - `STORAGE_KEYS` 的键值一经发布不可改（见 `src-web/AGENTS.md`「状态持久化」）；新增只加行，不复用已删键。
  - store 载荷迁移用 zustand 的 `version` + `migrate`；新增字段靠 `merge` 每次加载补齐，通常无需抬版本；默认值变更按根 `AGENTS.md`「数据兼容」不做旧档兼容。

## 4. 多窗口一致

- 广播通道：`BroadcastChannel("aigc-web-storage")`；环境不支持时 `channel = null`，静默降级为单窗口。
- 消息语义：**只带键，不带值** —— `{ keys: string[] }`；仅在一次事务提交成功后发送，键集为本次 `puts` + `deletes`。
- 接收流程（`syncFromDatabase`）：先 `initStorage()`，再 `db.records.bulkGet(keys)`，逐键比较：
  - 本窗口 `pendingPut`/`pendingDelete` 命中该键 → 跳过，**本地未落盘数据优先**，不被远端旧值覆盖。
  - 值未变 → 跳过；变了才更新 `cache` 并 `notifyKey`。
- 冲突仲裁：**不比较 `updatedAt`、不做版本协商**。收到广播后回查数据库当前值，等价于「后落库者胜」；广播载荷不参与仲裁，避免把消息当真值。
- 保护边界：`requeue` 只补「尚未被更新值覆盖」的键，保证失败回队不会用旧快照盖掉新写；启动装载时同样用待落库队列覆盖库值。
- 收敛责任在订阅方：
  - 门面只负责刷新镜像并通知，不主动改 store。
  - 当前显式订阅者：`components/theme-provider.tsx`（主题）与 `hooks/use-storage.ts` 的 `usePersistedValue`。
  - zustand store **不订阅**存储键；另一窗口改了侧栏/个性化后，本窗口 `ui` store 不会自动跟随，需要时由订阅方自行收敛。

## 5. 容量与失败

- 持久化许可：每次 `bootStorage` 申请一次 `navigator.storage.persist()`；不支持/失败只写 DEV 日志，降级为普通存储。
- 空间预判：每次 flush 前调 `navigator.storage.estimate()`，剩余 `quota - usage` 低于 `MIN_FREE_BYTES = 2 MiB` 视为不足；`estimate` 不存在、抛出或 `quota === 0` 时直接放行。
- 写满降级：不足 → 快照 `requeue` 回队列、置 `error`（`本地存储空间不足`）、安排退避重试；不抛给调用方，内存数据保留。
- 重试：仅失败提交与空间不足会排重试。延迟 `min(500 × 2^n, 30_000)` ms，`MAX_RETRY = 5`；单例重试定时器；成功后 `resetRetry`。用尽后不再自动排重试，靠后续新写或隐藏/卸载时的 flush 再次尝试。
- 数据库打开失败（`initStorage` 抛出）：`readyPromise` 清空以便重试，boot 直接失败；运行期 flush 遇此路径只置 `error`（`本地数据库不可用`），不排退避，等下一次写/flush 重新触发启动尝试。
- 写入语义：`writeText`/`removeText` 捕获启动失败后仍落内存与待落库队列，不向调用方抛错；flush 的错误一律收敛进 `StorageState`。
- 失败暴露给界面：
  - `StorageState`（`status: idle/pending/saving/error`、`pendingCount`、`error`）可经 `subscribeStorageState`/`getStorageState` 取得。
  - 启动失败由 `components/app-boot.tsx` 显示整页错误卡 + 重试（见 §7）。
  - `usePersistedValue` 转出 `saveStatus` 与 `retry`；当前页面只消费 `loadStatus`，运行期保存失败尚无专门的界面提示（如实记录）。

## 6. 边界规则

- 只有门面能碰存储：唯一允许直连的是 `src-web/src/lib/storage.ts`；其它文件一律经 `readText`/`writeText`/`removeText`/`flushStorage`/`storageAdapter`/订阅函数读写。
- lint 如何兜这条线（`src-web/eslint.config.js`）：
  - `no-restricted-imports`：`dexie` 只许 `@/lib/storage`。
  - `no-restricted-globals`：`localStorage`/`sessionStorage`/`indexedDB` 全局禁用。
  - `no-restricted-properties`：`document.cookie` 全局禁用。
  - `src/lib/storage.ts` 单独放宽上述三类，仅保留 `fetch` 与 Tauri/Eden 的架构禁令。
  - 同时受 `src-web/AGENTS.md`「架构边界」约束。
- 第三方库自管的键只做索引登记，不反向接管（`react-resizable-panels` 的实际落盘键就是登记 + 前缀派生）；`dev/layer-inspector.ts` 是唯一豁免，位置存取由宿主注入门面的 `readText`/`writeText`（见 `main.tsx`），工具本身零依赖。
- 首帧主题提示 cookie：
  - 名称 `aigc-theme`；属性 `Path=/; SameSite=Lax; Max-Age=1 年`。
  - 只承载最近一次主题档位，取值只允许 `light`/`dark`/`system`，非法值忽略。
  - **只允许**存这一枚枚举；**不允许**存任何其它数据、用户标识、同步载荷或业务状态，也不得当作持久化真值。
  - 写入点只在门面：`writeText` 命中 `theme` 键时，以及 `bootStorage` 装载后按记录刷新；无记录时清除。删键不会立即清 cookie，下次启动装载无记录时才清。
  - `src-web/index.html` 的内联脚本在样式加载前同步读它定色；缺失或非法回落 `system`（与 `ThemeProvider` 默认档同值）。
  - 为什么不共用 IndexedDB：IndexedDB 是异步读取，赶不上首帧样式；cookie 可同步读取，是唯一能在首帧前定色的介质，所以只放这一枚档位。

## 7. 加载态契约

三级加载态，延迟策略与失败出口各不相同：

| 级别 | 出现时机 | 延迟阈值 | 失败出口 |
|---|---|---|---|
| 首屏 | `AppBoot` 闸门：库打开/版本/导入/装载 + store 水合未完成 | 300ms（`SKELETON_DELAY_MS`），短于阈值不画骨架避免闪屏 | 整页错误卡 + 重试（重跑存储启动与水合） |
| 区块 | 页面某块依赖持久化值（当前实例：设置页分栏布局） | 无阈值，进入即按 `loadStatus` 决定 | 区块错误卡 + 重试（`SettingsLayoutError`） |
| 按钮 | 一次动作进行中（当前实例：令牌测试、聊天发送） | 无阈值，即时禁用/换图标 | 错误就地提示，动作按钮保持可用，再次点击即重试 |

- 首屏阶段文案 `PHASE_LABELS`：`open`/`version`/`import`/`load` 由门面发出；`hydrate` 由 `AppBoot` 合成（门面不 emit），表示 store 水合阶段。
- 区块：`usePersistedValue(key)` 给出 `loadStatus: loading/ready/error`；`loading` 画区块骨架，`ready` 才挂载依赖该值的布局（设置页必须等原文读完，避免先按默认值渲染再跳变）。
- 按钮：`test-token` 用 `disabled + Spinner`；聊天 `submitted/streaming` 时把发送换成停止，`submitted` 另显「思考中」占位。登录按钮无加载态，因为 `auth.login` 是本地同步写入 store。
- 三者区别（不得混为一谈）：
  - **加载中**：值尚未读出，不能先按默认值渲染（布局/几何依赖它时必须等待）。
  - **空数据**：记录不存在（`value === null`）或列表为空，按默认档/空态渲染，不是错误（设置页无存档时用默认分栏，聊天无消息时用 `Empty`）。
  - **失败**：读取失败，`value` 不可信；必须给错误卡 + 重试，禁止静默留空白。
  - **保存失败**不等于加载失败：`saveStatus` 的 `pending/saving/error` 只描述落库，不影响已展示的值，也不能当作加载态。

## 8. 服务端与同步现状

- 服务端数据库：MySQL / PostgreSQL / SQLite 三方言并存，按方言分目录隔离，均惰性连接（AOT 构建 dry-run 不建真实连接）。
  - MySQL：`drizzle-orm/mysql2`，连接池在 `src-bun/app/lib/mysql/index.ts`，读 `MYSQL_DATABASE_URL` / `MYSQL_DATABASE_POOL_LIMIT`。
  - PostgreSQL：`drizzle-orm/bun-sql`（Bun.SQL），连接在 `src-bun/app/lib/postgresql/index.ts`，读 `PG_DATABASE_URL` / `PG_DATABASE_POOL_LIMIT`。
  - SQLite：`drizzle-orm/bun-sqlite`（bun:sqlite），连接在 `src-bun/app/lib/sqlite/index.ts`，路径仅取 `SQLITE_DATABASE_PATH`（无默认值）；开 WAL + `synchronous=NORMAL` + `busy_timeout=5000`。
- 当前存在的表（`src-bun/app/model/<方言>/`，三方言结构一致）：
  - `user`：`id`（自增主键）、`email`（255，非空、唯一）、`name`（255，可空）。
  - `post`：`id`（自增主键）、`title`（255，非空）、`content`（文本）、`published`（布尔，非空、默认 false）、`author_id`（外键值，非空）。
  - 关系（各方言 `relations.ts`）：`user.posts` 一对多、`post.author` 多对一。
  - `runtime/generated/model/schema.ts` 按 `schema_<方言>_<表>` 命名导出 insert schema（如 `schema_mysql_user`），供请求校验与 OpenAPI 引用。
  - 字段描述集中在 `src-bun/app/model/describe.ts`，经 `description(table)` 注入 OpenAPI（只作文档，不影响校验与数据库）。
- Redis：`src-bun/app/lib/redis/index.ts` 按 `REDIS_URL` 惰性连接；`.env` 默认未启用，当前不承载任何业务持久化表。
- 聊天：流式、无状态，不落消息/会话表（此处的「会话」指 HTTP 登录会话/会话 Cookie，属规划态鉴权概念，与 `/chat` 页内存中的对话消息无关）。
- **同步与对象存储尚未实现**：
  - 没有上传/下载同步接口，没有同步包、墓碑、乐观锁或任务锁。
  - 没有对象存储服务、对象键、数据索引表、用户关联表。
  - 客户端 `records` 只存本机，不向服务端提交。
- 为将来同步预留的东西只有两处记录字段：
  - `dirty=1` 标记「本地有未同步变更」，当前所有新写与历史导入都置 1，且**没有任何代码把它写回 0**。
  - `updatedAt` 提供每个键的内容更新时间，供将来按时间做增量比较；当前只在 flush 时打时间戳，无消费方。
- 多窗口的 `BroadcastChannel` 是**本机同源窗口同步**，不是云端同步、不是服务端推送，二者不要混称。

## 9. 新增数据时的检查清单

加一个新键或新表，按顺序确认：

1. **键名归属**：在 `STORAGE_KEYS` 新增一行（值不可再改）；第三方库带前缀的用 `SETTINGS_LAYOUT_KEY` 式派生键。组件与 store 禁止写键名字面量，归属模块负责写入。
2. **防抖档位**：关键/低频键登记 0ms；高频偏好登记 400ms；未登记即 300ms。连续型数值只在提交时机写一次，禁止逐帧写；删除一律即时。
3. **是否要跨窗口同步**：门面会自动广播与刷新镜像；但 store 不自动跟随。需要本窗口其他消费者收敛时，显式 `subscribeStorageKey` 并在回调里落到 store（主题与 `usePersistedValue` 已这么做）。
4. **是否参与将来同步**：值必须能序列化成字符串；`dirty`/`updatedAt` 由门面自动维护，无需调用方写。追加型数据按单条逻辑键增量写，禁止整包重写数组。需要删除传播时注意：墓碑尚未实现。
5. **失败降级**：写入不得向调用方抛错、不得等落库结果；需要把保存态暴露给界面时用 `saveStatus` + `retry`；评估体积与 2 MiB 空间阈值。
6. **加载态**：页面在挂载时就要读的值走 `usePersistedValue`，区分 `loading`/空/`error`；布局或几何依赖它时不得先按默认值渲染；`error` 必须给重试。
7. **schema 与文档**：新增表/索引抬 `SCHEMA_VERSION` 并补 `stores`；store 载荷变更按 `version`/`migrate`/`merge` 处理；同一提交更新 `STRUCTURE.md` 对应条目（规则见根 `AGENTS.md`）。
