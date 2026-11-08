# 术语表（GLOSSARY）

> 这份文档是仓库术语的唯一解释处：其它文档（`AGENTS.md`、`STRUCTURE.md`、`清单.md`、各模块 README 与代码注释）引用术语时不再重复定义，出现分歧以本表为准，并优先以当前代码行为校正旧文档。
> 状态标记：〔实现〕当前代码存在；〔规划〕只见于 `清单.md` 等目标文档，当前快照未实现；〔已撤销〕历史方案，代码中禁止再引入。
> `src-web` 的持久化介质正在演进，本表涉及持久化的词条只写到职责层，不锁定具体库名或表名。

## 一、应用与外壳

- **三模块〔实现〕**：`src-web`（React 前端）、`src-bun`（Bun/Elysia 后端）、`src-tauri`（Rust 桌面壳）三个顶层模块，各自有 `AGENTS.md`，只通过 IPC 常量表、HTTP 路由与 `TAURI_SIDECAR` 环境变量契约交互。实现见根 `package.json` 的 workspaces 与 `STRUCTURE.md` 总览。易混：三模块不是三个可独立发布的包，桌面版由 Tauri 把 web 与 bun 组装在一起。
- **应用外壳 / AppShell〔实现〕**：桌面与 web 共用的主界面骨架，包含标题栏、常驻侧栏、内容区路由轨道和桌面描边层。实现见 `src-web/src/components/layout/app-shell.tsx`。易混：登录页 `/login` 不在 AppShell 内，它自带全屏滚动与窗口控制。
- **壳根〔实现〕**：AppShell 返回的最外层 `div`，负责整窗 flex 布局与 `overflow-hidden`，本身不画圆角、不设背景。实现见 `src-web/src/components/layout/app-shell.tsx`。易混：壳根不是 `html/body`；圆角与裁切只落在 `html/body`，壳根再画会因原点不同产生逐角递减。
- **桌面壳〔实现〕**：`src-tauri` 的 Rust 进程，负责创建无装饰透明窗口、启动 sidecar、下发令牌和窗口出场。实现见 `src-tauri/src/lib.rs` 与 `src-tauri/tauri.conf.json`。易混：桌面壳不负责页面视觉，标题栏、圆角、描边全部由 `src-web` 画。
- **标题栏 / TitleBar〔实现〕**：自绘的 2.5rem 高顶栏，含侧栏三态按钮、前进后退、拖动区和 chrome 动作簇。实现见 `src-web/src/components/layout/title-bar.tsx` 与 `src-web/src/index.scss` 的 `--spacing-titlebar`。易混：它不是 OS 原生标题栏；`decorations:false` 已关掉系统标题栏。
- **Chrome 动作簇〔实现〕**：标题栏与登录页顶栏共用的右端动作组，含主题、置顶、最小化/最大化/关闭。实现见 `src-web/src/components/layout/chrome-group.tsx`。易混：只统一动作组这一层，整条顶栏不抽象，因为壳内与登录页的定位方式不同。
- **IPC 契约〔实现〕**：`src-tauri` 的 `#[tauri::command]`/`emit` 与 `src-web` 的 `IPC`/`IPC_EVENT` 常量表必须逐条一致。实现见 `src-web/src/lib/tauri/index.ts` 与 `scripts/check_ipc.ts`。易混：`check:ipc` 是构建闸门，不是运行时校验；新增命令必须同时改两端常量表。
- **出场 / reveal_window〔实现〕**：窗口启动时保持最小化/隐藏，前端首屏提交后发 `reveal_window`，Rust 执行 unminimize + show + focus。实现见 `src-web/src/components/layout/window-bootstrap.tsx` 与 `src-tauri/src/lib.rs` 的 `present_window`。易混：不能用 rAF/onload 触发；最小化时 WebView2 停帧，rAF 可能永不回调。
- **窗口描边 `[data-app-edge]`〔实现〕**：仅桌面渲染的 1px inset 边线，颜色取 `--edge`，半径继承 `--app-radius`。实现见 `src-web/src/components/layout/app-shell.tsx` 与 `src-web/src/index.scss`。易混：它不是 Rust 画的 DWM 边框；Win11 的 1px 系统框线已在 Rust 侧关掉。
- **sidecar〔实现〕**：Tauri 在 release 下启动的 `bun-service` 子进程，承载本地 `/api` 与 `/offline`。实现见 `src-tauri/src/sidecar.rs` 与 `src-bun/app/index.ts`。易混：dev 模式没有 sidecar，后端由 `scripts/dev.ts` 直接用 bun 启动。
- **sidecar 令牌 / SidecarToken〔实现〕**：Tauri 生成的一次性随机令牌，release 下 48 位，经 `TAURI_SIDECAR` 注入子进程，并经 `sidecar_token` 下发给前端。实现见 `src-tauri/src/state.rs` 与 `src-bun/app/common/tauri_sidecar.ts`。易混：令牌非空只表示「进程已就绪且未退出」，不是登录态。
- **Sidecar 就绪 / SidecarReady〔实现〕**：Rust 侧的就绪标志，进程确认启动后才置真，退出即清零。实现见 `src-tauri/src/state.rs` 与 `src-tauri/src/sidecar.rs`。易混：前端 `sidecarToken()` 的 Promise 缓存是缓存，`SidecarReady` 才是可用性真值。
- **sidecar-terminated〔实现〕**：sidecar 意外退出时 Rust 发出的事件，前端清令牌缓存并提示本地服务不可用。实现见 `src-tauri/src/sidecar.rs` 与 `src-web/src/main.tsx`。易混：它只表示本地 sidecar 失效，不代表远程 `/api` 不可用（服务版桌面仍走远程）。
- **输入守卫〔实现〕**：桌面端禁用右键、F5/Ctrl+R、F11 等默认行为，并拦截文件拖入。实现见 `src-web/src/shortcuts/webview.ts` 与 `src-web/src/shortcuts/registry.ts`。易混：守卫条目也在快捷键注册表里登记，设置页展示与安装同源。
- **平台真源〔实现〕**：判断 Windows/macOS/Linux 以 Rust `shell_platform` 为准，UA 只用于首帧解析回来之前的兜底。实现见 `src-tauri/src/commands.rs` 与 `src-web/src/lib/tauri/index.ts`。易混：`isTauri` 只区分桌面/浏览器，不细分平台。
- **壳最小宽 375〔实现〕**：桌面窗口最小 375×667，低于前端 768 移动断点，因此窄窗口会命中 Sheet 抽屉侧栏。实现见 `src-tauri/tauri.conf.json` 与 `src-web/src/hooks/use-mobile.ts`。易混：375 是窗口尺寸，768 是布局断点，两者不是同一类阈值。

## 二、导航与页面

- **路由表 / router〔实现〕**：全局 `createHashRouter`，`/login` 独立于外壳，`/` 挂 AppShell 与 `shellRoutes`。实现见 `src-web/src/routes/router.tsx`。易混：路由表不是页面清单；页面归属在 `src-web/src/routes/registry.ts`。
- **外壳子路由表 / registry〔实现〕**：`shellRoutes` 是外壳子页的唯一归属表，同时供 `createHashRouter` 的 children 与路由轨道使用。实现见 `src-web/src/routes/registry.ts`。易混：新增页面只改这里，不要再在侧栏或轨道里另存一份清单。
- **导航元数据 / handle.nav〔实现〕**：路由对象 `handle.nav` 携带侧栏导航的 label/icon/order，`navItems` 由 `shellRoutes` 派生。实现见 `src-web/src/routes/registry.ts`。易混：不挂 `nav` 的页仍在路由里可访问，只是不进侧栏（如设置页、登录页）。
- **动效档 / handle.motion〔实现〕**：每页声明的 `enter`/`query`/`reveal` 三档动效元数据，由路由轨道唯一读取。实现见 `src-web/src/routes/registry.ts` 与 `src-web/src/components/layout/page-track.tsx`。易混：动效档不是组件 props；按钮和页面不得自己触发切页动画。
- **路由轨道 / PageTrack〔实现〕**：替换 `Outlet` 的内容区轮播容器，最多 3 个页面槽，换页只平移轨道。实现见 `src-web/src/components/layout/page-track.tsx`。易混：轨道不是 `react-router` 的 Outlet；全应用只有它一处监听路由。
- **页面槽 / PageSlot〔实现〕**：轨道中的一个页面实例，保活自己的滚动位置与组件状态，非当前槽 `inert` + `aria-hidden`。实现见 `src-web/src/components/layout/page-track.tsx`。易混：页面槽不是路由；同一个路径可能对应不同槽身份。
- **槽身份 / key〔实现〕**：轨道判定「是不是同一个页面槽」的键，`query:"slot"` 用完整地址，`query:"local"` 只用 pathname。实现见 `src-web/src/components/layout/page-track.tsx`。易混：槽身份不是 React key，也不是路由 path；它决定同路径换 query 时是否新开槽。
- **整页动 vs 局部动〔实现〕**：`enter:"pan"` 让整条轨道平移一格；`query:"local"` 表示同路径子地址留在原槽、只做页内内容块动效。实现见 `src-web/src/routes/registry.ts` 与 `src-web/src/components/layout/page-track.tsx`。易混：两者不得混用，局部动不许推整条轨道，整页动不许再叠加整页淡入。
- **历史穿越 / observePath〔实现〕**：后退/前进按钮改变历史条目时，`observePath()` 比较条目号给出方向；全应用只有它读 `history.state.idx`。实现见 `src-web/src/lib/route-history.ts`。易混：历史穿越不是菜单点击；菜单点击是新条目，方向由轨道按目标槽位置决定。
- **条目号 / idx〔实现〕**：react-router 写入 `history.state.idx` 的历史条目序号，用于判断本次是前进还是后退。实现见 `src-web/src/lib/route-history.ts`。易混：条目号不是路由序号，也不是页面槽序号；同一路径可在历史里出现多次。
- **设置分区 / `?section=`〔实现〕**：设置页的页内分区标识（当前 `shortcuts`/`personalize`），以 URL 为唯一事实，非法值回落首项。实现见 `src-web/src/routes/pages/settings.tsx`。易混：设置分区不是后端路由前缀，也不是「三档路由」里的离线/业务/公共分区。
- **页面归属〔实现〕**：一个页面由哪张路由表、哪个 `Component` 字段拥有；外壳页归 `shellRoutes`，登录页归 `src-web/src/routes/router.tsx`。实现见 `src-web/src/routes/registry.ts` 与 `src-web/src/routes/router.tsx`。易混：页面归属不等于导航可见性；设置页有归属但不进侧栏。
- **骨架槽 / SlotReady〔实现〕**：懒加载页面在 Suspense 内挂载完成后才发就绪信号，骨架阶段的槽不保活、不占 3 个槽位。实现见 `src-web/src/components/layout/page-track.tsx`。易混：`SlotReady` 是页面挂载信号，不是数据加载完成信号。
- **深链〔实现〕**：可直接打开并恢复到指定页内状态的 URL，例如 `/settings?section=personalize` 与 `/login`。实现见 `src-web/src/routes/router.tsx` 与 `src-web/src/routes/pages/settings.tsx`。易混：深链依赖 hash 路由；改成 history 路由会破坏静态部署刷新。

## 三、主题与外观

- **主题 / Theme〔实现〕**：用户选择的明暗档，三值为 `light`/`dark`/`system`，持久化在 `STORAGE_KEYS.theme`。实现见 `src-web/src/components/theme-provider.tsx` 与 `src-web/src/hooks/use-theme-switch.ts`。易混：主题不是「生效明暗」；`system` 需要再解析。
- **生效主题 / resolvedTheme〔实现〕**：当前实际渲染的明暗值，`system` 已解析成 `light`/`dark`。实现见 `src-web/src/components/theme-provider.tsx`。易混：`resolvedTheme` 不是用户选择值；判断「换档但明暗没变」要用它。
- **系统偏好 / systemTheme〔实现〕**：操作系统当前的明暗偏好，来自 `prefers-color-scheme` 媒体查询。实现见 `src-web/src/components/theme-provider.tsx`。易混：`systemTheme` 不是当前主题；它只是 `system` 档的解析来源。
- **主题切换事务 / startThemeTransition〔实现〕**：包装 `document.startViewTransition`，在回调内同步落 html class，失败调用 rollback，不支持 VT 时直接切换。实现见 `src-web/src/lib/theme-transition.ts`。易混：它是唯一允许全屏呈现的动画；路由切页不用 VT。
- **圆形揭示 / vt-circle〔实现〕**：主题切换时的全屏圆形收放动画，参数 `--vt-x`/`--vt-y`/`--vt-r` 由事务写入，关键帧在 `src-web/src/index.scss`。实现见 `src-web/src/lib/theme-transition.ts` 与 `src-web/src/index.scss`。易混：它不是 JS 逐帧动画；JS 只写几何变量。
- **主题入口 / ThemeMenu〔实现〕**：标题栏、登录页顶栏、设置页、侧栏用户菜单四处共用的明暗控件接线点。实现见 `src-web/src/components/layout/theme-menu.tsx`。易混：`ThemeMenu` 是接线点，不是选项表；选项表在 `src-web/src/hooks/use-theme-switch.ts` 的 `THEME_ROWS`。
- **明暗选项表 / THEME_ROWS〔实现〕**：主题三档的值、文案、图标登记表，新增档只改这里。实现见 `src-web/src/hooks/use-theme-switch.ts`。易混：`THEME_ROWS` 不是控件形态；控件形态在 `src-web/src/components/option-switch.tsx`。
- **首帧主题提示 cookie〔实现〕**：名为 `aigc-theme` 的极短 cookie，只承载最近一次主题档位，供 `src-web/index.html` 在样式加载前定色。实现见 `src-web/index.html` 与 `src-web/src/lib/storage.ts`。易混：cookie 不是持久化真值；真值在持久化层，cookie 只是首帧提示。
- **原生明暗 / setWindowTheme〔实现〕**：把当前明暗同步给 Windows 的 DWM/WebView2，供任务栏缩略图与 Alt-Tab 着色；mac/Linux 不动。实现见 `src-web/src/lib/tauri/index.ts` 与 `src-web/src/components/theme-provider.tsx`。易混：跟随系统档必须传 `null`；传显式值会钉死 `prefers-color-scheme`。
- **页面画布 / PageCanvas〔实现〕**：每页自带的背景资产，经 Portal 铺到壳根锚点，含衬层与内容面两层。实现见 `src-web/src/components/layout/page-canvas.tsx`。易混：画布不是全局背景；主干链（窗口→html/body→壳根→标题栏→侧栏）一律零背景。
- **画布锚点 / CanvasAnchor〔实现〕**：壳根中 `absolute inset-0 -z-10` 的唯一挂载点，页面画布 Portal 到这里。实现见 `src-web/src/components/layout/page-canvas.tsx` 与 `src-web/src/components/layout/app-shell.tsx`。易混：锚点不是 context；槽位与订阅由 `page-canvas` 模块自持。
- **当前画布 / CanvasOwner〔实现〕**：路由轨道逐槽声明的「是否为当前页」标记，只有当前页铺画布。实现见 `src-web/src/components/layout/page-canvas.tsx` 与 `src-web/src/components/layout/page-track.tsx`。易混：多页保活时不能各铺一层半透内容面，否则颜色叠加变浓。
- **内容面 vs 衬层〔实现〕**：内容面是半透壳色 + 自糊 + 左上内圆角的前景层；衬层是实心壳色 + 噪点 + 两处径向晕染的底层。实现见 `src-web/src/components/layout/page-canvas.tsx` 与 `src-web/src/index.scss` 契约条目 3。易混：衬层恒实心，不受 `glassFilm` 影响；`glassFilm` 只改内容面。
- **个性化旋钮〔实现〕**：`glassBlur`、`glassFilm`、`bgWash` 三个用户可调值，分别控制内容面自糊半径、内容面壳色不透明度、衬层背景渐变开关。实现见 `src-web/src/store/ui.ts`、`src-web/src/lib/glass-channel.ts` 与 `src-web/src/routes/pages/settings.tsx`。易混：旋钮真值在 store，不是 CSS 变量；`--glass-blur`/`--film-a`/`--wash-a` 只是发布结果。
- **圆角 / corners〔实现〕**：窗口四角半径（默认 7，0=直角），真值在 `src-web/src/store/ui.ts`，经 `radius-channel` 合成 `--app-radius`。实现见 `src-web/src/store/ui.ts`、`src-web/src/lib/radius-channel.ts` 与 `src-web/src/index.scss`。易混：圆角不是 Rust 状态；最大化时通道输出 0，Rust 不做该判断。
- **圆角通道 / publishRadius〔实现〕**：把四角半径写到文档根 `--app-radius` 的唯一发布者，只出值、不挂标记。实现见 `src-web/src/lib/radius-channel.ts`。易混：它不是组件；形状与裁切由 `html, body` 的静态规则消费。
- **侧栏宽度通道 / publishWidth〔实现〕**：把 `--sidebar-width` 写到文档根的唯一发布者，侧栏、画布内容面、body Portal 的悬浮侧栏都继承它。实现见 `src-web/src/lib/sidebar-channel.ts`。易混：宽度上下限 `WIDTH_MIN`/`WIDTH_MAX` 也在这个模块，拖拽与持久化收敛共用同一档。
- **外观令牌单源〔实现〕**：`--shell`、`--edge`、`--separator`、`--chrome-*`、`--nav-idle`、`--line-h`/`--line-v`、`--spacing-titlebar` 等变量的登记处，`:root` 与 `.dark` 各一份。实现见 `src-web/src/index.scss`。易混：令牌不是具体色值或尺寸；新增颜色/间距必须先登记变量，禁止在组件里写第二份字面量。
- **断点 768〔实现〕**：移动端布局断点，`--breakpoint-md`、SCSS 媒体查询与 `src-web/src/hooks/use-mobile.ts` 三处同值。实现见 `src-web/src/index.scss` 与 `src-web/src/hooks/use-mobile.ts`。易混：它是布局断点，不是桌面窗口最小宽 375。
- **动效单源 / motion.ts〔实现〕**：anime.js 的唯一入口，提供 `useMotionScope`、`revealStagger`、`shake` 与 `prefersReducedMotion` 守卫。实现见 `src-web/src/lib/motion.ts`。易混：页面和组件不得直接 import `animejs`，也不得写死时长/缓动。
- **注册表覆写契约〔实现〕**：`src-web/src/index.scss` 中编号列出的、对 shadcn/Base UI 生成组件的手改清单，升级 CLI 后逐条复查。实现见 `src-web/src/index.scss` 的「注册表覆写契约」一节。易混：它不是组件 API；`shadcn add --overwrite` 后必须按清单复原。
- **系统材质（已撤销）〔已撤销〕**：Tauri 的 `windowEffects`/`set_effects` 方案已评估并撤销，磨砂全部由 `src-web` 的 CSS 出。结论见 `src-tauri/AGENTS.md` 与 `src-tauri/tauri.conf.json`（当前无 effects 配置）。易混：不要再加 effects 命令或 conf 配置；系统材质会连带 DWM 投影与 1px 框线。

## 四、持久化

- **持久化门面 / storage.ts〔实现〕**：前端唯一允许读写本地持久化数据的入口，封装启动、迁移、内存镜像、防抖落库、重试与跨窗口同步。实现见 `src-web/src/lib/storage.ts`。易混：其它模块不得直连浏览器存储；唯一例外是首次运行的历史数据导入。
- **逻辑键 / STORAGE_KEYS〔实现〕**：持久化键的登记表，值一经发布不可改，新增只加行。实现见 `src-web/src/lib/storage.ts`。易混：逻辑键不是实际落盘键；某些第三方库会在逻辑键前加自己的前缀。
- **实际落盘键 / SETTINGS_LAYOUT_KEY〔实现〕**：逻辑键经第三方库前缀拼出的实际键，例如设置页分栏布局的 `react-resizable-panels:` 前缀。实现见 `src-web/src/lib/storage.ts`。易混：实际键不是逻辑键；改前缀等于丢历史布局。
- **记录 / StoredRecord〔实现〕**：持久化层的最小数据单元，含逻辑键、原始字符串值、更新时间与脏标记。实现见 `src-web/src/lib/storage.ts`。易混：记录不是业务对象；业务对象由 zustand JSON 序列化后放进 `value`。
- **内存镜像 / cache〔实现〕**：启动时从持久化介质全量装载的键值镜像，读 API 只认它；写操作先改镜像再排队落库。实现见 `src-web/src/lib/storage.ts`。易混：镜像不是普通缓存副本，当前实现把它声明为「内存为真源」。
- **真值 vs 缓存〔实现〕**：真值是某一层被授权解释的权威值；UI 领域真值在 zustand store，持久化领域真值是内存镜像，耐久介质只是落盘副本。缓存是由真值派生、可重建的副本，例如 `tokenPromise` 只缓存非空令牌。易混：不要把「库里有值」当成业务真值，也不要把内存镜像叫缓存——本实现把它声明为持久化真源。
- **待落库 / pendingPut / pendingDelete〔实现〕**：写操作先进入待落库集合，按防抖窗口合并，随后批量提交。实现见 `src-web/src/lib/storage.ts`。易混：待落库不是失败态；失败态由 `StorageState.status = "error"` 表示。
- **落库 / flushStorage〔实现〕**：把待落库的写入与删除合并为一次批量提交，失败保留内存数据并指数退避重试。实现见 `src-web/src/lib/storage.ts`。易混：`flushStorage` 是持久化层的提交函数，不是页面级「保存」按钮的同义词。
- **防抖分层 / DEBOUNCE_BY_KEY〔实现〕**：按逻辑键配置落库防抖时长，登录态/主题等关键键即时写，UI 偏好等中频键合并写。实现见 `src-web/src/lib/storage.ts`。易混：防抖不是节流；同一键窗口期内只保留最后一次值。
- **持久化状态 / StorageState〔实现〕**：面向界面的 `idle`/`pending`/`saving`/`error` 四态，含待落库键数与最近错误。实现见 `src-web/src/lib/storage.ts` 与 `src-web/src/hooks/use-storage.ts`。易混：持久化状态不是启动阶段；启动阶段是 `open`/`version`/`import`/`load`/`hydrate`。
- **启动阶段 / StoragePhase〔实现〕**：持久化层启动的五个阶段，`AppBoot` 与 `useStorageHydration` 用它们显示进度文案。实现见 `src-web/src/lib/storage.ts` 与 `src-web/src/components/app-boot.tsx`。易混：阶段不是状态；阶段只描述启动过程，状态描述运行期落库。
- **水合 / rehydrate〔实现〕**：持久化数据装载完成后，显式调用 zustand 的 `persist.rehydrate()` 把 store 填回持久值。实现见 `src-web/src/components/app-boot.tsx` 与 `src-web/src/store/ui.ts`。易混：水合不是自动发生的；两个 store 都设置了 `skipHydration`，必须由启动闸门显式触发。
- **storageAdapter〔实现〕**：给 zustand `persist` 用的异步存储适配器，把 `getItem`/`setItem`/`removeItem` 转到持久化门面。实现见 `src-web/src/lib/storage.ts` 与 `src-web/src/store/ui.ts`。易混：适配器不是存储实现；它只是门面的一个消费方。
- **迁移 vs 收敛〔实现〕**：`migrate` 只在持久化版本变化时跑；`merge` 每次加载都跑，用同一个收敛函数补齐缺失字段并挡住脏值。实现见 `src-web/src/store/ui.ts`。易混：迁移不是每次加载都跑；同版本的手改脏值靠 `merge` 挡。
- **历史导入 / legacy import〔实现〕**：首次运行时把旧本地存储的键一次性搬进当前持久化介质，成功后清理原键并写导入标记。实现见 `src-web/src/lib/storage.ts`。易混：历史导入不是持续兼容层；导入完成后旧键不再参与读写。
- **跨窗口同步〔实现〕**：同一来源的多个窗口通过广播频道互相通知变更，收到后回查持久化介质并刷新内存镜像。实现见 `src-web/src/lib/storage.ts`。易混：跨窗口同步不是云端同步；它只在本机同源窗口之间生效。
- **默认档 vs 上限〔实现〕**：`*_DEFAULT` 是首次使用与重置时的默认值，`*_MAX` 是滑杆/收敛的上限。实现见 `src-web/src/store/ui.ts`。易混：默认档不是兜底 CSS；`src-web/src/index.scss` 里的 `:root` 值只是首帧兜底。
- **持久化介质〔实现〕**：承载逻辑键与记录的本地异步存储；本表只描述职责，不锁定库名或表名。实现见 `src-web/src/lib/storage.ts`。易混：介质不是业务数据库；它只存前端键值记录，不承担后端模型的查询。

## 五、聊天与模型

- **AI 对话 / ChatPage〔实现〕**：`/chat` 示例页，展示流式对话、空态、错误提示与输入条。实现见 `src-web/src/routes/pages/chat.tsx`。易混：「对话」是页面与消息列表，不是后端会话实体。
- **对话 vs 会话〔实现/规划〕**：本仓库的「对话」指 `/chat` 页与内存中的 `UIMessage[]`；「会话」在 `清单.md` 中指 HTTP 登录会话/会话 Cookie，属于规划态鉴权概念。实现见 `src-web/src/routes/pages/chat.tsx` 与 `清单.md`。易混：当前代码没有聊天会话实体，也没有把消息按会话持久化。
- **UI 消息 / UIMessage〔实现〕**：AI SDK 的消息形状，含 `id`、`role` 与 `parts`，前后端流式传输共用。实现见 `src-web/src/routes/pages/chat.tsx` 与 `src-bun/app/controller/api/chat.ctrl.ts`。易混：`UIMessage` 不是数据库消息模型；它只存在于运行时。
- **消息分片 / parts〔实现〕**：`UIMessage.parts` 中的内容片段，当前页面只消费 `text` 分片。实现见 `src-web/src/routes/pages/chat.tsx`。易混：parts 不是 Markdown 段落；一个消息可以有多个 text part。
- **传输层 / DefaultChatTransport〔实现〕**：AI SDK 的聊天传输实现，负责把消息 POST 到 `/api/chat` 并注入 sidecar 鉴权头。实现见 `src-web/src/lib/chat.ts`。易混：传输层不是网络请求封装库；`fetch` 白名单只开在 `src-web/src/lib/chat.ts`。
- **useChat 状态〔实现〕**：AI SDK 的对话状态机，当前页面用 `submitted`/`streaming` 判断忙碌，用 `ready`/`error` 切换界面。实现见 `src-web/src/routes/pages/chat.tsx`。易混：`status` 不是 HTTP 状态码；它是 AI SDK 的对话状态。
- **流式 UI 消息响应〔实现〕**：后端用 `createUIMessageStreamResponse` + `toUIMessageStream` 返回 UI 消息流，不走统一信封。实现见 `src-bun/app/controller/api/chat.ctrl.ts`。易混：流式响应不是普通 JSON；它的错误分支用 `Response.json(..., { status })`。
- **模型提供方 / OpenAI 兼容 provider〔实现〕**：后端用 `createOpenAICompatible` 创建名为 `custom` 的提供方，可接 Ollama、DeepSeek 或自建网关。实现见 `src-bun/app/controller/api/chat.ctrl.ts`。易混：提供方不是模型；同一个提供方可以接多个模型 ID。
- **模型 ID / AI_MODEL〔实现〕**：根 `.env` 中的模型标识，与 `AI_BASE_URL`、`AI_API_KEY` 一起决定请求目标。实现见 `src-bun/app/controller/api/chat.ctrl.ts` 与 `.env`。易混：模型 ID 不是提供方名称；缺失时接口返回明确的 500 错误。
- **提示词 / prompt〔实现〕**：聊天输入框中的一段用户文本，提交后成为一条 `UIMessage`。实现见 `src-web/src/routes/pages/chat.tsx` 的 `PromptForm`。易混：这里不是「提示词资源」；没有提示词库、模板或文件化真值。
- **思考中 / Trace〔实现〕**：请求已提交但尚未出字时显示的占位轨迹，使用官方 `Trace` 原语。实现见 `src-web/src/routes/pages/chat.tsx` 与 `src-web/src/components/ui/trace.tsx`。易混：它不是推理链/思考过程数据；当前只是状态占位。
- **消息滚动器 / MessageScroller〔实现〕**：官方聊天滚动原语，负责贴底跟随、回到底部按钮与消息行容器。实现见 `src-web/src/components/ui/message-scroller.tsx` 与 `src-web/src/routes/pages/chat.tsx`。易混：不要换成 AI Elements 的 `conversation`/`use-stick-to-bottom`，会与官方原语重复。
- **停止生成 / stop〔实现〕**：生成中把发送按钮切换为停止按钮，调用 AI SDK 的 `stop()` 中止请求。实现见 `src-web/src/routes/pages/chat.tsx`。易混：停止不是删除消息；已产生的消息仍留在列表中。

## 六、资源（Agent / Skill / MCP / 提示词）

- **Agent 技能 / Skill〔实现〕**：`.agents/skills/<name>/SKILL.md` 形式的技能文档包，由 CLI 安装与维护，供编码助手读取。实现见 `.agents/skills/` 与 `skills-lock.json`。易混：它不是应用运行时的 Agent 能力，也不是后端资源表。
- **技能锁 / skills-lock.json〔实现〕**：记录 `.agents/skills` 安装来源与哈希的锁文件，由 CLI 维护。实现见根 `skills-lock.json`。易混：锁文件不是业务数据；不要手改。
- **Agent〔规划〕**：`清单.md` 中可新建、编辑、设为公共的智能体资源，内含专属提示词并可启用 Skill/MCP。当前快照没有 Agent 运行时、资源表或相关接口。易混：不要把它和 `.agents/skills` 的「Agent 技能」混为一谈。
- **MCP〔规划〕**：`清单.md` 中可通过勾选启用的外部工具协议配置，规划要求能接入任意种类的 MCP。当前快照没有 MCP 客户端、服务端或配置存储。易混：MCP 不是 Skill；Skill 是本地文档包，MCP 是外部协议连接。
- **提示词资源〔规划〕**：`清单.md` 中可新建、编辑、设为公共的提示词条目，规划要求以文件为真值、数据库只留索引。当前快照只有聊天输入，不存在提示词库。易混：聊天输入 `prompt` 是一次性文本，不是提示词资源。
- **资源文件化〔规划〕**：`清单.md` 的口径——提示词、Agent、Skill、MCP 都以文件为真值，数据库只留索引，磁盘按用户分目录。当前快照未实现。易混：这不是当前 `src-web/src/lib/storage.ts` 的键值持久化。
- **AI Elements registry〔实现〕**：`src-web/components.json` 中 `@ai-elements` 指向的 AI 向组件注册表，只在官方 shadcn 无对应物时按单件安装。实现见 `src-web/components.json` 与 `src-web/AGENTS.md` 的选型阶梯。易混：AI Elements 不是资源；它是组件来源，且与官方重复时留官方。
- **官方 shadcn registry〔实现〕**：`src-web/src/components/ui/` 下由 shadcn CLI 生成的组件来源，优先于 AI Elements 与自建组件。实现见 `src-web/components.json` 与 `src-web/src/components/ui/`。易混：官方 registry 不是 `@ai-elements`；两者的清单地址与安装写法不同。
- **选型阶梯〔实现〕**：组件选型顺序——官方 shadcn registry → AI Elements（仅 AI 语义件）→ 自建，且必须说明前两级为何不行。实现见 `src-web/AGENTS.md` 的「生态优先级」。易混：选型阶梯不是目录规范；目录规范只决定文件放哪里。

## 七、后端与路由分区

- **Bun 服务 / Elysia app〔实现〕**：`src-bun/app/index.ts` 导出的 Elysia 实例，组合插件、控制器与路由后监听 `PORT`。实现见 `src-bun/app/index.ts`。易混：Bun 服务不是 sidecar；同一个代码既能作为 sidecar 跑，也能作为服务器部署跑。
- **sidecar 形态 vs 服务器形态〔实现〕**：以 `TAURI_SIDECAR` 解析出的 token 是否为空区分；非空=本地 sidecar，空=服务器/开发。实现见 `src-bun/app/common/tauri_sidecar.ts` 与 `src-bun/app/plugins/controller.plug.ts`。易混：形态不是平台；web 部署版也是服务器形态，桌面服务版也可以是服务器形态。
- **`/api`〔实现〕**：通用业务路由前缀，本地 sidecar 与服务器两种形态都提供。实现见 `src-bun/app/controller/api/` 与 `src-web/src/lib/backend.ts`。易混：`/api` 不是「业务分区」；当前只有 `/api` 与 `/offline` 两档，业务鉴权尚未实现。
- **`/offline`〔实现〕**：桌面端本机能力路由前缀，只在本机 sidecar 形态可用。实现见 `src-bun/app/controller/offline/` 与 `src-bun/app/plugins/controller.plug.ts`。易混：服务器形态访问 `/offline` 一律 404，不是 401；门控按令牌判形态，不按路径鉴权。
- **控制器 / `.ctrl.ts`〔实现〕**：`src-bun/app/controller/<前缀>/` 下的路由模块，默认导出一个接收控制器实例的函数。实现见 `src-bun/app/controller/api/chat.ctrl.ts`。易混：控制器不是插件；控制器只声明路由，鉴权/日志/错误在控制器插件里统一处理。
- **路由前缀〔实现〕**：`src-bun/app/controller/<目录名>` 自动生成的 URL 前缀，目录层级即路径层级。实现见 `src-bun/system/script/routes.ts` 与 `src-bun/system/generated/routes.ts`。易混：路由前缀不是设置页分区，也不是持久化键前缀。
- **生成路由 / system/generated/routes.ts〔实现〕**：由生成器自动产出的路由组合文件，把所有控制器前缀组合进默认导出，漏导出=该前缀不可达。实现见 `src-bun/system/generated/routes.ts`。易混：生成文件不是手写入口；不要直接编辑，改控制器后重跑生成器。
- **路由生成器 / system/script/routes.ts〔实现〕**：扫描 `src-bun/app/controller/`、生成 `src-bun/system/generated/routes.ts` 的脚本，dev 时 watch 自动重跑。实现见 `src-bun/system/script/routes.ts` 与 `src-bun/system/script/index.ts`。易混：`bun run generate_script` 只跑生成器；`bun run generate` 会连带 drizzle 迁移。
- **路由分区〔规划〕**：`清单.md` 中的三档鉴权分区——离线分区要桌面令牌、业务分区要登录令牌、公共分区免凭证。当前快照只有 `/offline` 与 `/api` 两档，业务登录令牌未实现。易混：路由分区不是设置页分区；前者按 URL 前缀与鉴权划分，后者是页内 UI 状态。
- **`$g`〔实现〕**：后端唯一全局聚合对象，挂 `db`/`logger`/`redis`/`res`/`ctrl`/`success`/`error`/`counter`。实现见 `src-bun/app/common/index.ts` 与 `src-bun/system/types/global.d.ts`。易混：`$g` 不是 Elysia 上下文；它是模块级工具聚合。
- **`$g.ctrl`〔实现〕**：控制器工厂，把「接收控制器实例的函数」包成可直接默认导出的控制器。实现见 `src-bun/app/common/index.ts` 与 `src-bun/app/controller/api/chat.ctrl.ts`。易混：`$g.ctrl` 不是路由注册器；路由仍由生成器组合。
- **统一信封 / `{ msg, code, data }`〔实现〕**：普通 JSON 响应的统一形状，`code=1` 成功、`code=0` 错误，由 `success`/`error` 构造。实现见 `src-bun/app/common/index.ts` 与 `src-bun/app/common/schemas.ts`。易混：流式响应与原生 `Response` 不走信封；别在 SSE 分支套 `$g.success`。
- **流式原生响应〔实现〕**：handler 直接返回 Web `Response`（如 UI 消息流），绕过统一信封。实现见 `src-bun/app/controller/api/chat.ctrl.ts` 与 `src-bun/AGENTS.md`。易混：原生响应不是错误分支的 `Response.json`；前者是正常流，后者是带状态码的错误。
- **控制器插件 / controller.plug〔实现〕**：控制器范围内的统一插件，负责请求日志、`/offline` 门控、sidecar 令牌校验与全局错误处理。实现见 `src-bun/app/plugins/controller.plug.ts`。易混：控制器插件不是 Elysia 根插件；它只作用于控制器路由范围。
- **请求 ID / rid〔实现〕**：每个请求在 `derive` 阶段生成的 UUID，写入日志用于串联一次请求。实现见 `src-bun/app/plugins/index.plug.ts` 与 `src-bun/app/plugins/controller.plug.ts`。易混：rid 不是用户 ID，也不是 trace ID。
- **校验错误 / ValidationError〔实现〕**：Elysia 的 schema 校验失败错误，控制器插件会取第一条错误并格式化为 `[type] property : message`。实现见 `src-bun/app/plugins/controller.plug.ts`。易混：它不是业务错误；业务错误应返回 `$g.error`，不要抛 `ValidationError`。
- **数据模型 / mold〔实现〕**：`src-bun/app/model/*.mold.ts` 中的 Drizzle 表定义，由 `src-bun/app/model/index.ts` 聚合，schema 经生成器注册。实现见 `src-bun/app/model/` 与 `src-bun/system/generated/schema.ts`。易混：mold 不是 TypeBox schema；TypeBox 用于请求/响应校验，mold 用于数据库表。
- **API 类型树 / gen-api〔实现〕**：由 `genApiTypes` 生成到 `src-web/types/gen-api/` 的声明树，供 Eden treaty 解析后端类型。实现见 `src-bun/system/script/genApiTypes.ts` 与 `src-web/src/lib/api.ts`。易混：gen-api 是生成产物，不是手写类型；不入库。
- **Elysia 实例 name〔实现〕**：每个 Elysia 实例的静态唯一名称，AOT 用它匹配 manifest。实现见 `src-bun/app/plugins/index.plug.ts`、`src-bun/app/plugins/controller.plug.ts` 与 `src-bun/system/generated/routes.ts`。易混：文档要求显式常量名，当前代码仍用 `$g.counter.n`/`num()`；这是已知偏差，新增实例不要继续用计数器。
- **AOT〔实现〕**：构建期由 `aot()` 插件预编译 Elysia 路由，入口必须是 `src-bun/app/index.ts`，最终由 Bun 编译成单文件可执行产物。实现见 `src-bun/system/script/build.ts` 与 `src-bun/app/cluster.ts`。易混：AOT 不是 `precompile` 运行期选项，也不产出独立的产物目录；两者可以共存但作用不同。
- **cluster〔实现〕**：多进程封装，默认关闭，`CLUSTER_ENABLED=true` 时 spawn `src-bun/app/index.ts` 作为 worker。实现见 `src-bun/app/cluster.ts` 与 `src-bun/AGENTS.md`。易混：当前 worker 仍指向源码入口，若与 AOT 单文件产物同用需先改指向产物，否则 AOT 失效。
- **日志 / logger〔实现〕**：后端按日写入日志目录（运行时生成），控制器插件记录请求与错误，sidecar 终端日志另存 exe 同级目录。实现见 `src-bun/app/lib/logger.ts`、`src-bun/app/plugins/controller.plug.ts` 与 `src-tauri/src/sidecar_terminal_log.rs`。易混：应用日志不是 sidecar 终端日志；两者目录与用途不同。

## 八、同步与对象存储

- **跨窗口同步〔实现〕**：同源多窗口通过 `BroadcastChannel` 互相通知持久化键变更，收到后回查并刷新内存镜像。实现见 `src-web/src/lib/storage.ts`。易混：跨窗口同步不是云端同步，也不是服务端推送。
- **增量同步〔规划〕**：`清单.md` 中的手动+自动同步能力，按修改时间判断上传或下载。当前快照未实现；`StoredRecord.updatedAt`/`dirty` 只是预留字段。易混：预留字段不是同步实现，不能据此宣称已有增量同步。
- **同步包〔规划〕**：`清单.md` 中一次性打包用户全部文件（含提示词等资源）的同步载荷，上传前判断空间。当前快照未实现。易混：同步包不是 `dist` 构建产物。
- **对象存储〔规划〕**：`清单.md` 中的远端文件存储，至少含数据索引表与用户关联表。当前快照没有对象存储服务或相关接口。易混：对象存储不是 `src-bun/public` 静态资源目录。
- **对象键〔规划〕**：对象存储中不透明、不承载业务路径的键；路径真值只存在数据索引表。当前快照未实现。易混：对象键不是文件系统路径，也不是逻辑键 `STORAGE_KEYS`。
- **数据索引表〔规划〕**：对象存储侧记录上传者、对象相对地址、分类、文件类型、大小等元数据的表。当前快照未实现。易混：数据索引表不是前端持久化记录。
- **用户关联表〔规划〕**：对象存储侧记录对象与用户关系的表，规划用于配额、权限与公共资源判定。当前快照未实现。易混：用户关联表不是前端 `auth` store。
- **墓碑〔规划〕**：同步协议中用于表达删除的标记，避免删除被增量同步漏掉。当前快照未实现。易混：墓碑不是数据库软删除状态字段。
- **乐观锁 / 任务锁〔规划〕**：同步协议以内容更新时间为乐观锁基线，并用 60 秒心跳、180 秒可抢占的任务锁串行化同步。当前快照未实现。易混：任务锁不是 UI 的 loading 状态。
- **静态资源 / public〔实现〕**：`src-bun/public/` 下由静态插件提供的资源目录，不是对象存储。实现见 `src-bun/app/plugins/index.plug.ts` 与 `src-bun/public/icon.png`。易混：静态资源不是同步包，也不是对象存储对象。

## 九、构建与分发

- **三种分发形态〔实现〕**：桌面离线版（web+bun 全在客户端）、桌面 bun 部署版（`/api` 走远程、`/offline` 走本地）、web 全量部署版（只有服务器 `/api`）。实现见根 `AGENTS.md` 的「分发与环境处理」与 `src-web/src/lib/backend.ts`。易混：三种形态不是三个代码分支；差异收敛在地址与令牌判据。
- **dev 编排 / scripts/dev.ts〔实现〕**：并行拉起 bun、web、tauri 三个 dev 进程，并固定 `process.env` 传给子进程。实现见 `scripts/dev.ts`。易混：改 `.env` 后必须重启根 dev；子进程 watch 重启不会重读父进程环境。
- **build 编排 / scripts/build.ts〔实现〕**：生产构建顺序——`check:ipc` → 注入 config → web/bun 并行 → tauri → 复制 `dist`。实现见 `scripts/build.ts`。易混：build 不是 dev 的镜像；build 会跑 IPC 闸门并复制发布产物。
- **config 注入 / scripts/config.ts〔实现〕**：把 `devUrl` 与 `externalBin` 写进 `src-tauri/tauri.conf.json`，内容未变不落盘。实现见 `scripts/config.ts`。易混：config 注入不是运行时配置；它改的是 tracked 的 Tauri 配置文件。
- **externalBin〔实现〕**：Tauri 打包 sidecar 的配置项，生产值为 `../src-bun/bun-service`（配置字面量，Tauri 按 target triple 选取实际文件），开发留空。实现见 `scripts/config.ts` 与 `src-tauri/tauri.conf.json`。易混：`externalBin` 不是前端资源路径；它只决定 sidecar 是否随包分发。
- **bun-service〔实现〕**：sidecar 二进制的逻辑名，构建脚本按 Rust target triple 产出 `bun-service-<target>`，Tauri 打包后以 bun-service.exe 的名字落到 release 产物目录。实现见 `src-bun/system/script/build_tauri_bun.ts` 与 `src-tauri/src/sidecar.rs`。易混：`bun-service` 不是 `src-bun` 源码目录，也不是 `bun` 运行时本身。
- **dist〔实现〕**：根目录发布输出，构建后包含 AIGC.exe、bun-service.exe、`.env` 与 public 子目录。实现见 `scripts/build.ts`。易混：`dist` 不是 `src-web/dist`；前者是最终发布目录，后者是前端静态产物。
- **产品标识〔实现〕**：`productName`/`identifier` 决定窗口标题、可执行文件名与数据目录（`com.aigc`）。实现见 `src-tauri/tauri.conf.json` 与 `src-web/src/components/brand-logo.tsx`。易混：改标识=换数据目录，旧数据不迁移。
- **devUrl〔实现〕**：开发模式下 Tauri 加载的前端地址，由 `VITE_PORT` 注入（当前 17900）。实现见 `scripts/config.ts` 与 `src-tauri/tauri.conf.json`。易混：devUrl 不是生产前端地址；生产走打包后的静态文件。
- **release 自检 / build.rs〔实现〕**：release 构建时断言 `externalBin` 含 `bun-service`，缺失即中断，防止绕过 scripts 直接 `tauri build` 出坏包。实现见 `src-tauri/build.rs` 与 `src-tauri/AGENTS.md`。易混：自检不是运行时检查；它只发生在 cargo 构建脚本阶段。
- **devtools feature〔实现〕**：Cargo feature `devtools`，仅 dev 由 `scripts/dev.ts` 传入，release 不含 DevTools。实现见 `src-tauri/Cargo.toml` 与 `scripts/dev.ts`。易混：不能用 `cfg(debug_assertions)` 选依赖，否则 cargo 告警且失效。
- **平台基线〔实现〕**：Windows 10+、macOS 10.15+、Linux 取决于 webkitgtk；oklch 与 View Transitions 在旧运行时自动降级。实现见根 `AGENTS.md` 的「桌面系统版本基线」。易混：平台基线不是断点；前者是系统能力，后者是布局尺寸。
- **类型闸门〔实现〕**：web 侧类型检查必须用 `bun node_modules/typescript/bin/tsc -b --force`，`tsc --noEmit` 会复用 `.tsbuildinfo` 假通过。实现见 `src-web/package.json` 的 `typecheck` 与根 `AGENTS.md` 的验证方式。易混：类型闸门不是构建；构建还包含 Vite 打包。
- **生成 vs 构建〔实现〕**：`bun run generate_script` 只生成路由/类型；`bun run generate` 会并行跑所有 `generate_*`，包括 drizzle 迁移。实现见 `src-bun/package.json` 与 `src-bun/AGENTS.md`。易混：两者不是同义词；手动加路由后只跑 `generate_script`。
- **工作区 / bun〔实现〕**：根 `package.json` 声明 `src-bun`、`src-web` 两个 workspace，统一用 bun 作为包管理器。实现见根 `package.json`。易混：`node_modules` 不属于任何模块，禁止修改。
