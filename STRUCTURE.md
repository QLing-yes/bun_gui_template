# 目录结构索引

> 本文件是全项目「目录 → 文件 → 职责」索引。**任何文件增删、移动、目录职责变化必须同一提交内更新本文件**（规则锚点在根 AGENTS.md）。
> 定位：索引，不是规范——规则看各模块 AGENTS.md，踩坑看 EXPERIENCES.md。条目一行一条，写职责不写实现。

## 总览

```
bun_gui_template/
├── scripts/          # 根编排脚本（dev/build/tauri 配置注入）
├── src-bun/          # Bun + Elysia 后端（桌面本地服务与服务器部署两形态）
├── src-web/          # React + Vite 前端（web 与桌面 WebView 共用）
├── src-tauri/        # Tauri v2 桌面壳（Rust）
├── .agents/skills/   # Agent 技能（shadcn 等，CLI 维护）
├── .vscode/          # 编辑器配置（类常量命名提示等）
├── package.json      # 根脚本入口（dev/build/check:ipc）+ workspaces
├── tsconfig.json     # 根 TS 配置（Bun 侧 scripts 与 src-bun 工具脚本）
├── skills-lock.json  # .agents/skills 安装锁（CLI 维护）
├── .env              # 环境变量单一来源（新增/修改后必须重启根 dev）
├── AGENTS.md         # 全局规则 + 分发/平台基线
├── EXPERIENCES.md    # 跨模块经验沉淀
└── STRUCTURE.md      # 本文件
```

三模块互不牵扯，各自内部管理；跨模块契约见文末速查表。

## scripts/

- `dev.ts` — 并行拉起各模块 dev 进程；启动时固定 process.env 传子进程；tauri dev 带 `--features devtools`
- `build.ts` — 生产构建编排，首个参数选择目标：缺省桌面（`check_ipc` → config → web/bun 并行 → `tauri build --no-bundle` → dist），`android`/`ios` 为移动端（`check_ipc` → web → `tauri android|ios build`，不含 bun、不产 dist）；dist 阶段除拷主程序与 `.env`，还把构建机 `process.execPath`（即当前 bun）复制为 `dist/bun/bun(.exe)`（POSIX 补可执行位），供产物直接启动服务
- `config.ts` — 向 tauri.conf.json 注入 devUrl（内容未变不落盘，避免 tracked 文件恒脏）
- `check_ipc.ts` — IPC 契约漂移检查：Rust `#[tauri::command]`/`generate_handler!`/`emit` 与 src-web `IPC`·`IPC_EVENT` 常量表逐条比对，漂移即退出非零
- `spawn.ts` — 子进程启动公共封装
- `round_icons.ts` — 全端图标圆角后处理（bun + sharp + png-to-ico，去 Python 依赖）：`tauri icon` 重生成后运行，半径=尺寸×7/32；矢量掩膜 dest-in 抗锯齿、重跑幂等；覆盖主图/桌面族/ico（png-to-ico）/icns（无在更 npm 包，按 Apple 规格手写容器）/android/ios/web icon

## src-web/（React 19 + Vite + Tailwind v4 + shadcn base-ui + zustand + react-router/hash）

根配置：
- `vite.config.ts` — react 插件；Tailwind 走 `css.postcss`（样式入口是 .scss，vite 插件模式会漏编译）
- `components.json` — shadcn CLI（css→src/index.scss；registry 组件的 cn 直接落 `cn` 包，无 lib/utils 落点；registries：@ai-elements、@useanimations=`https://useanimations.com/r/{name}.json`）
- `eslint.config.js` — 含架构边界强制：IPC 仅 `lib/tauri/`、Eden 仅 `lib/api.ts`、fetch 仅 `lib/chat.ts`、Dexie 与 localStorage/sessionStorage/indexedDB/document.cookie 仅 `lib/storage.ts`
- `index.html` — 入口 + favicon + 首帧主题提示脚本（样式加载前只解析极短 cookie `aigc-theme`，非法/缺失回落跟随系统，避免 IndexedDB 异步读取前闪色）
- `types/gen-api/` — 生成的 API 类型树（不入库）：由 src-bun/utils/generate 的 genApiTypes 产出，`tsconfig.app.json` 的 `@/*`·`@bun/*`·`*` 别名都指向这里，web 端 Eden 类型从此解析

src/：
- `main.tsx` — 挂载入口：引全局样式、输入守卫、sidecar 退出监听、`<AppBoot>` 启动闸门（IndexedDB 装载 + store 水合完成后才渲染，期间整页骨架/错误重试/自动退避）、`<ThemeProvider>`（主题上下文根，初始档位取自启动结果）、`<TooltipProvider/>`（全路由单实例，登录页与主壳共用）、`<Toaster/>`（全局提示出口）、`<StorageStatusToast/>`（落库失败轻提示）、`<WindowBootstrap/>`（圆角通道发布 + 窗口出场时机）
- `index.scss` — 全局样式单一入口：Tailwind 引入、主题令牌(:root/.dark 含 --shell/--edge/--separator/--chrome-*/--nav-idle/--line-h|--line-v/侧栏宽度通道默认值/--app-radius 兜底/--surface-radius 内容面内圆角/--glass-blur·--film-a·--wash-a 个性化旋钮兜底/--push-duration·--ease-push 切页平移/--push-duration-fast 面板收起展开快档)、窗口钩子 `html, body`（圆角与裁切静态规则，值取 `--app-radius`）·`[data-app-edge]`（描边层）、`@theme inline`（--breakpoint-md=768px、--spacing-titlebar=2.5rem）、「注册表覆写契约」索引节（升级 CLI 前按该清单复查）、VT 圆形揭示、基础层
- `assets/` — 打包静态资源；`public/logo.svg` — 品牌 logo（favicon/侧栏/登录共用，明暗自适应）；`public/bgrgb.png` — 登录页光晕位图（`.bg-gradient` 类引用）
- `styles/typeset.scss` — Markdown 排版样式

components/：
- `ui/` — shadcn CLI 生成，勿手改（已知例外：sidebar.tsx 删 cookie 写入与内置 Ctrl+B、侧栏容器/Provider 不再 inline 宽度变量（移动端 Sheet 内仍内联 `--sidebar-width`）；button.tsx 加 chrome 态色变体 + ghost 改用 `--chrome-hover/press` 标度；scroll-area.tsx 删未用 React 导入；empty.tsx/trace.tsx 删 descendant-svg 强制尺寸规则——尺寸改由统一入口 size 透传）
- `app-boot.tsx` — 启动闸门（main.tsx 根级包住全应用）：`useStorageHydration` 驱动库打开/版本/导入/装载阶段，就绪后显式水合 zustand store 并安装跨窗口 store 同步；前 300ms 不画骨架，超时才铺整页骨架并显示阶段文案；失败显示错误卡 + 手动重试，库打开失败自动指数退避重试（等待期错误卡追加「正在自动重试」，成功后自动恢复流程）；转出启动结果（主题档位）供 ThemeProvider
- `storage-status-toast.tsx` — 运行期落库失败全局轻提示：订阅 `lib/storage` 状态，固定 toast id 合并连续失败，显示「保存失败」与待重试条数，动作按钮触发 `flushStorage`，状态回到空闲（重试成功）自动收起；启动失败不在此提示（由 AppBoot 错误卡负责）
- `brand-logo.tsx` — 品牌 logo 统一组件（默认 size-5 = 侧栏图标+4px）
- `chat.tsx` — AI 聊天组件（官方聊天原语 + useChat 流式，零路由/零存储/零地址感知）：唯一入口参数 `session` 对象（`ChatSession` = 初始消息 + `onComplete` 完整完成回调 + 可选 `onStatusChange` 流式状态回调 + 可选 `invalidated` 对话被外部删除时停孤儿流；停止/断线/报错不触发 onComplete），新建项目/项目内新对话/续聊共用同一组件、靠不同 session 数据驱动；PageCanvas 背景归调用方，组件只铺满父容器
- `icons.tsx` — 图标统一入口（唯一调用点，业务零直引图标库）：`AnimationIcon` 为 Lottie 显式入口；lottie 懒加载独立 chunk + requestIdleCallback 空闲预取、Suspense 回落同名静态；尺寸单源 `size` 默认 24 对齐 lucide-react（chrome 显式 16/14）；转发 style/data-icon/aria-label，无 label 默认 aria-hidden；导出 APP_ICON_NAMES/iconTierOf 供审计页
- `animation-icon.tsx` 光学归一：`UA_OPTICAL_SCALE` 逐图标系数（实测占盒比→目标 0.75，clamp 0.7–1.7；动画位姿测不到回落 1.33）挂 CSS 独立 scale（与 rotate 正交、不变形）；`--icon-stroke` 反补描边 parity（2×32/24÷factor）；容器盒=内层盒=size、aspect-square 全链锁正方；微调入口 dev 审计页
- `animation-icon.tsx` — AnimationIcon 的 lottie 分支（懒加载 chunk）：useanimations 官方 registry 件登记表（白名单 5 键，与 icons.tsx 的 UaName 同源）；加载态 loadingV2 在此
- `use-animation.tsx` + `animations/` — useanimations 官方 shadcn registry 件（`@useanimations` 别名，CLI 生成勿手改）：player `UseAnimation`（useMemo 共享 animation 对象）+ 逐图标件 `AnimatedX`（Lottie JSON 模块级单例）；目录只留在用 5 件，扩动效先 `shadcn add @useanimations/<name>` 再进 icons.tsx 登记表
- `page-card.tsx` — 单卡片演示页骨架（PageCanvas + 内容页内边距 + 标题/说明/正文卡片；鉴权测试与受限示例页共用）
- `option-switch.tsx` — 选项切换控件：一行分段选项 + 实心浮起游标标示选中（状态机与键盘导航用官方 ToggleGroup）；参数 `options`（值/名称/可选图标）、`value`、`onChange(next, origin?)`（origin＝被点选项中心）+ 窄位档 `size`/`iconOnly`；内衬 sm 2 / default 4、左右恒 4（内部常量，不对外）；游标位移与宽高由脚本直写 style（不进 React 状态），`useLayoutEffect` 首帧就位 + `ResizeObserver` 跟随尺寸变化；宽度恒自适应内容；配色、时长与缓动常量都在本文件（导出 `SLIDE_MS` 供调用方等滑行），index.scss 只保留游标拉伸 `@keyframes option-switch-stretch`；圆角固定 32px（模块常量，不可调；轨道用之、游标恒半圆端）
- `theme-provider.tsx` — 主题上下文（light/dark/system，html class 与 Windows 窗口原生明暗同步落；未选过时默认 system（跟随系统），与 index.html 首帧脚本同值；转出 `theme`/`resolvedTheme`（system 已解析）/`systemTheme`（系统偏好，供切换前预判是否空转）/`setTheme`）；系统明暗变化在 system 档复用 `lib/theme-transition` 的同一圆形揭示（起点取视口中心、优先级 system），固定档只刷新 `systemTheme` 不动视觉；`system` 档给原生窗口传 null（不钉死 PreferredColorScheme）
- `stagger-reveal.tsx` — 错峰入场容器（直接子元素逐个进场，`trigger` 变化重播；anime.js 只经 `lib/motion` 懒加载接入，作用域异步就绪后补播首次入场；默认 `contents` 不额外造盒）；`RevealPolicyProvider` 由轨道逐槽声明该页的 `reveal` 档，容器自查是否播放
- `layout/` — 应用外壳：
  - `app-shell.tsx` — 应用壳根（本身不画圆角，整窗形状由文档根承担）：`<CanvasAnchor/>` 锚点 + TitleBar + 常驻侧栏（三态经 store/ui 纯函数翻译）+ 内容区（`ContentLayout` 内嵌路由轨道 PageTrack）+ 桌面专属末尾 `[data-app-edge]` 描边层；宽度/磨砂/渐变变更时发布到通道
  - `content-layout.tsx` — 内容区分栏（页面轨道外层，只分配空间、不感知路由）：外层 `ResizablePanelGroup orientation="vertical"` 先切「上半部（主内容+右栏）/ 底栏（横跨整条内容区）」；上半部再嵌 `orientation="horizontal"` 切「主内容（PageTrack）/ 右栏」——右下角归底栏、无三方拼缝；面板取自 `ui/resizable`（shadcn 封装），尺寸用百分比字符串 + `withHandle` 把手；拖动期库直改几何、松手（`onLayoutChanged` 用户交互）才提交，尺寸与两条收起态合存 `STORAGE_KEYS.contentSplit` 单键（不用库自带 autoSaveId）；启动闸门放行后经 `readTextSync` 同步取真值，首帧即用户记录；收起态单源在 `store/content-split`（本文件订阅后驱动面板、并负责把尺寸+收起态落盘），面板标题区保留关闭按钮（图标与标题栏该面板开关同款）且与标题栏共用同一 store（只收不起，展开仍只在标题栏/热键）；右栏最小宽 200、底栏最小高 160、主内容最小 560×360（px 常量），`collapsedThreshold="100%"` 让拖动只停在最小尺寸、不吸附收起；内容区宽 <760 / 高 <520 自动收起对应面板（不落盘，窗口恢复还原，标题栏按钮随之受限）；DEV 日志（拖动开始/提交、尺寸恢复、自动收起原因）；收起展开过渡只给用户切换播——临时在根上挂 `data-animating="open|close"`（CSS 过渡面板外层内联 `flex-grow` + 面板内容 opacity，目标由根上 `data-off-*` 与布局层同批写入；时长取快档单源 `--push-duration-fast`、缓动 `--ease-push`，内容 0.7 档、错峰 0.3 档，总时长 200ms），拖动按下、自动收起、减少动效、主题圆形揭示时立即摘除并即时到位，连续切换改写目标值即从当前视觉位置折返
  - `content-split-actions.tsx` — 标题栏里的内容区右栏/底栏开关（主题菜单之后、窗口置顶之前；登录页不挂载）：状态读 `store/content-split`，图标反映当前状态、提示文案描述下一次点击并带 registry 快捷键位；窄屏自动收起时置灰（`aria-disabled`）并保留可点，点击用 toast 说明原因
  - `page-canvas.tsx` — 页面背景画布：自持锚点槽位（`CanvasAnchor` + useSyncExternalStore，无 context）；每页两层＝壳色噪点晕染衬层 + 半透磨砂内容面；`surfaceLeft(mode, desktop)` 是本模块拥有的偏移算法（left 直写 style）；`CanvasOwner active` 声明当前页——路由轨道保活多页时只有当前页铺画布（半透内容面不得叠加）
  - `page-track.tsx` — 内容区路由轨道（替换 Outlet，挂在 content-layout 的主内容槽内，`PageTrack`/`PageSlot` 均 memo 隔离外壳重渲染）：唯一的路由监听，按 `registry.handle.motion` 决定动画；最多 3 个页面槽，当前页居中、序号越大越靠左；换页只改轨道位移 → 平移一个槽宽（旧页右移出屏、新页从左侧紧贴移入，无透明度变化），右栏/底栏不随换页移动；方向：历史穿越比条目号（小＝往左），菜单点击比目标槽停在哪一侧（左邻＝往右、右邻＝往左，没缓存过的新页往右）；每槽覆盖自己的 Location、自带 ScrollArea 与 Suspense，非当前槽 inert + aria-hidden、收尾后 `visibility:hidden` 冻结，离屏槽另经 `content-visibility:auto` 跳过布局与绘制（平移期间强制 visible 保证入屏页第一帧完整；槽尺寸显式声明不塌缩、滚动位置保留）；骨架屏阶段的槽不保活（`SlotReady` 报就绪后才计入缓存）；懒加载骨架（PageCanvas 衬底 + Skeleton）同文件内定义
  - `class-names.ts` — 跨文件共享的外壳/页面类串单源：`PAGE_PAD_CLASS`（普通内容页内边距，chat 全高自滚页不接入）、`FILL_CLASS`（撑满父容器的基础组合，flex/纵向/间距由使用处追加）、`SIDEBAR_LABEL_CLASS`（侧栏折叠淡出标签盒，品牌区另追 `w-0/flex-none`）
  - `chrome-group.tsx` — 窗口 chrome 动作簇：`ChromeGroup` 左右容器（`side` 决定 pl-2/pr-2）+ `ChromeActions` 右端主题/（可选插槽）/置顶/窗口三键（标题栏与登录页顶栏共用，登录页不传插槽）；只统一这一层，整条 chrome 条不抽象（壳内流内 header、登录 fixed、浏览器档两个悬浮角定位不同）
  - `icon-action.tsx` — 图标按钮 + 下方提示的统一外壳（标题栏/侧栏图标动作一律用它）
  - `title-bar.tsx` — `h-titlebar` 自绘标题栏：三态开关/前进后退 + 拖动区 + 主题/内容区右栏底栏开关/置顶/窗口三键
  - `sidebar-body.tsx` — 侧栏正文（品牌+导航+项目分区+用户；固定与悬浮共用，tooltip=false 抑制全宽态提示且项目分区不收图标态）：品牌区/导航区为本文件就地定义的小段，项目分区与用户区独立成文件；导航无分区标题，「新建项目」经 `store/chat-drafts` 复用未首聊草稿（不重复开空白槽）；移动端导航先收抽屉再延时导航；导航项可用性由 `lib/access` 的 `useAccess` 按路由 `handle.access` 判定，受限项保持可见但加锁图标/降透明度，tooltip 与 title 给出所需权限（点击仍进入该页，由页面层展示无权限空状态）
  - `sidebar-projects.tsx` — 侧栏项目分区（导航之下占余高、ScrollArea 区域滚动）：项目行=染色 Folder 图标（id 哈希定色相、oklch 色调恒定）+名称点击展开对话子列表+右侧「新建对话」（经 `store/chat-drafts` 复用该项目未首聊草稿）与「更多」按钮；项目/对话右键菜单与更多菜单共用动作表（重命名=内联 Input、删除=AlertDialog 确认、级联删且正在浏览被删对象时退回新建项目）；当前对话所属项目无手动记录时默认展开；图标折叠态收成单枚项目图标、HoverCard 悬停右侧浮出同一份项目列表（点导航先收浮层）
  - `sidebar-user.tsx` — 侧栏底部用户区菜单（明暗模式=菜单内一行右侧内嵌 `ThemeMenu`（`skipSame` + 滑完游标才收菜单 + 事务再等浮层），个性化=`/settings?section=personalize` 深链、设置、登录/退出）
  - `sidebar-cycle-trigger.tsx` — 三态循环按钮（提示=下次点击效果；移动端=抽屉开合）
  - `sidebar-peek.tsx` — hidden 态左缘悬浮侧栏（官方非模态 Sheet + 热区 hover 唤出；几何/磨砂/1px 极浅描边/遮罩统一在 index.scss 的 sidebar-peek 契约条目里）
  - `sidebar-resizer.tsx` — 展开态拖宽手柄（自持指针拖拽：宽度 = 按下时宽度 + 指针行程，拖动中只写文档根通道变量，pointerup 提交 store；命中区 16px、视觉线 0.5px 居中；指针捕获按 best-effort 处理，失败不吃掉提交）
  - `theme-menu.tsx` — 明暗入口，四处共用的唯一接线点（标题栏/登录页顶栏/设置页/侧栏菜单）：`OptionSwitch` 三档；参数 `size`/`iconOnly`（标题栏与侧栏窄档只显图标、设置页带文案）、`onSlideDone`（滑完游标先收浮层）、`settleExtraMs`（切换事务再等浮层消失的下限）、`skipSame`；选项与切换事务在 `hooks/use-theme-switch`
  - `window-drag-region.tsx` — 拖动区（原生 app-region 转发 + JS 双轨兜底，双击最大化）
  - `window-controls.tsx` — 最小/最大/关闭三键（仅桌面；关闭键 Windows 红）
  - `window-pin.tsx` — 窗口置顶开关（仅桌面；不随重启保留）
  - `window-bootstrap.tsx` — 首屏窗口引导（main.tsx 里与 RouterProvider 同级，全路由一份）：圆角合成发布（store 四角半径 + 最大化状态 → `lib/radius-channel`）+ 首屏提交后发 `reveal_window` 就绪信号（启动阶段窗口最小化，此处才还原+显示+聚焦；禁用 rAF 触发，最小化时 WebView2 停帧）
- `flow/` — React Flow 演示（`flow-demo.tsx` 画布编排、`step-node.tsx` 自定义节点=官方 Card，退出全局磨砂、定宽）

routes/：
- `router.tsx` — 路由表：`/login` 独立于外壳；壳内子路由取自 `registry.ts`
- `registry.ts` — 外壳子页路由表（index=新建项目对话页/chat 对话载体/flow/settings + 桌面专属 test + 受限示例 restricted，全部 lazy 分包；末尾 `path:"*"` 为未知路径兜底页，不要求额外权限）：`createHashRouter` 的 children 与路由轨道共用同一数组；每页 `handle.motion` 携动效档（enter 整页动 / query 同页地址档 / reveal 页内错峰档），`handle.nav` 携侧栏导航元数据（label/icon/order；不挂 nav 的页不进侧栏——chat 入口在侧栏项目分区，桌面专属 test 随路由注册一并门控），`handle.access` 携所需权限（权限声明唯一处；菜单可用性与页面准入都从它派生）；`navItems` 由此派生、`sidebar-body`（导航段）只消费；`resolveRoute(path)` 一次匹配同时给出页面组件、动效档与权限声明；`restricted` 为演示项（声明 `demo:restricted`，正式接入角色体系后删除）
- `pages/` — `dev-icons` 图标光学审计页（仅 DEV 注册路由 `#/dev/icons`，不挂 nav，release 摇树移除；全登记键 ×16/24 并排 + tier 标注，目检占盒/居中/描边 parity 后回改 UA_OPTICAL_SCALE） / `chat` AI 对话页适配层（地址 → `ChatSession` 数据后渲染 `components/chat` 同一组件；地址三态：index `/` 或 `?draft=`=新建项目草稿、`/chat?project=&draft=`=项目内新对话草稿、`/chat?id=`=续聊已存对话；草稿经 `store/chat-drafts` 登记（每范围至多一个、再点新建复用、裸地址挂载时收敛到登记草稿、落库后清登记）；草稿首条 AI 回复完整完成才经 `store/projects` 落库——停止/断线/报错不算，随后 replace 到 `/chat?id=` 并请求 `/api/title` AI 命名（新建项目一次生项目名+对话名分别应用，项目内新对话只生对话名、项目名不动），失败保留占位名；后续每次完整回复整份更新消息；流式期切走则冻结槽只落库不劫持地址；地址指向已删对话给空状态） / `flow` 流程测试 / `login` 表单登录（预留校验；根是 `h-svh overflow-y-auto` 滚动容器 + 内层 `min-h-full` 居中盒——主干 overflow 恒 hidden，页面必须自滚，矮窗口不截断；左上角返回入口：可后退走 navigate(-1)，直达时兜底 replace 到主界面，桌面档摆在 40px 拖动条左端、web 档悬浮左上）/ `settings` 官方 Tabs 分区导航（当前分区以 URL `?section=` 为唯一事实，非法值回落首项；≥768 可拖宽分栏；分区表（id/label/icon/Panel/action）同时驱动导航、面板与标题行右侧动作：快捷键=Item/Kbd 清单，个性化=明暗模式（`ThemeMenu`）+ 磨砂两滑杆 + 背景渐变开关 + 四角圆角四滑杆 + 标题右侧「重置」回默认档；滑杆拖动期只更新本地草稿并直写 CSS 通道做即时预览，松手（`onValueCommitted`）才提交 store；宽档分栏布局由 `usePersistedValue` 异步读取，未完成显示区块骨架、失败显示重试卡，不先按默认值渲染再跳变）/ `test-token` sidecar 令牌测试（仅桌面，结果用官方 Code Block）/ `empty-state` 空状态页（两种语义共用一套 shadcn `Empty`：`NotFoundPage` 页面不存在=未知路径兜底，`AccessDeniedPage` 没有访问权限=路由权限未通过；标题、当前路径回显、所需权限、「返回新建项目」、可后退时给「返回上一页」；沿用 `PageCanvas` + `PAGE_PAD_CLASS`，命中时 DEV 记录判定依据）/ `restricted-demo` 受限示例演示页（仅当当前账号具备 `demo:restricted` 时渲染，说明演示用途与解除/恢复方式；正式接入角色体系后删除）

dev/（零依赖原生工具，可整体拷走；独立使用的开发期工具，不属于组件体系，不参与组件化与复用合并，不为风格统一改造、不接入 ui/lib/hooks 通道）：
- `layer-inspector.ts` — 层级背景检视器：`mountLayerInspector(storage)` 唯一导出（幂等，返回卸载函数；卸载会清 `data-dlx` 标记与 window 监听）。位置存档不直连存储：由宿主注入异步 `{ read(key), write(key, value) }`（main 在 DEV 下传 `lib/storage` 的 `readText`/`writeText`），挂载前先异步读出位置再建 UI。自动扫描绘制层（html、body 恒为 #0/#1 底层，其余按 `getComputedStyle` 自带 bg/背景图/backdrop-filter/box-shadow/outline 判定），文档顺序即层序并记最近登记父层；`[data-dlx=n]` + 注入样式表逐层 `visibility` 切换——只在「祖先正被隐藏会继承下来」时才补 visible，绝不顶掉宿主自己的 visibility；默认由内向外，⇄ 反转，⟳ 重扫；面板 = 可拖动吸边按钮 + 进度条/数字框 + tag#id.class.data-* 折叠树，点标签复制裸词（剪贴板失败可框选 Ctrl+C）；工具自身打 `[data-dlx-ui]`，扫描跳过且样式永久豁免

store/（zustand；`ui`/`auth`/`projects` 走 persist 落盘，键名一律取 `lib/storage.ts` 登记表，经其 `storageAdapter` 异步写入；`skipHydration` 关闭自动水合，由 `components/app-boot.tsx` 在 IndexedDB 装载完成后统一 `persist.rehydrate()`；`migrate`+`merge` 共用同一收敛函数，每次加载挡住脏值；`content-split`/`chat-drafts`/`chat-runs` 为运行态不接 persist）：
- `ui.ts` — 侧栏三态模式 + 宽度（默认 260px，与 index.scss `--sidebar-width` 兜底同值；收敛进 `sidebar-channel` 的 160–480）+ 个性化四项组（`glassBlur` 12px、`glassFilm` 76%、`bgWash` 默认开、`corners` 四角半径 7px；默认档 `*_DEFAULT` 与上限 `BLUR_MAX`/`FILM_MAX`/`RADIUS_MAX` 同处登记，滑杆、迁移与回默认档共用；**改默认不做旧数据兼容**——旧值原样留着，要统一就在个性化里重置）+ `resetPersonalize()`（一次回默认档，不动侧栏）；v4（v1 迁旧二态、v2 加磨砂、v3 撤系统材质、v4 四角半径入库）
- `auth.ts` — 登录态（预留，无服务端校验）；非字符串用户名按未登录处理
- `projects.ts` — 项目/对话/消息全量树（单键 `aigc-projects`）：创建项目、项目下建对话、整份覆盖消息、重命名、级联删除；落库时机由聊天页决定（首条完整回复），占位名常量 `PROJECT_PLACEHOLDER`/`CONVERSATION_PLACEHOLDER` 供 AI 命名返回前过渡；非数组载荷按空库处理
- `content-split.ts` — 内容区右栏/底栏收起态单源（标题栏开关与布局层共用；运行态不接 persist，尺寸与收起态仍由 `content-layout` 写 `STORAGE_KEYS.contentSplit` 一个键）：用户收起两布尔 + 窄屏自动收起两布尔 + `hydrate/setAuto/toggle`（`toggle` 在自动收起期间静默忽略并留 DEV 痕）
- `chat-drafts.ts` — 未落库聊天草稿登记处（运行态、不持久化、不跨窗口同步）：范围键（"new"/项目 id）→ 草稿{id,address}，每范围至多一个；`openDraft` 已有复用/没有新建（再点新建不重复堆空白槽）、`clearDraft` 首条回复落库后清、`clearScope` 项目删除时清；侧栏新建入口与聊天页裸地址收敛共用
- `chat-runs.ts` — 聊天生成态登记处（运行态、不持久化、不跨窗口同步）：槽地址 → 生成中对话/草稿 id（`setRun` 置/清，`isRunning` 派生）；聊天页按流式状态上报、卸载/槽裁剪清除；侧栏对话行、项目行（旗下任一含草稿）、新建项目 nav（草稿期）据此显 loadingV2 徽标，冻结槽流式也可见

hooks/：
- `use-mobile.ts` — 移动断点判定（768px 的 JS 侧唯一来源，与 index.scss 的 --breakpoint-md 同值）
- `use-history-nav.ts` — 前进/后退可用性，直接转出 `lib/route-history` 的账本快照（不再自读 history.state）
- `use-storage.ts` — 持久化上层钩子（只消费 `lib/storage` 异步 API 与订阅）：`useStorageHydration()` 转出启动阶段/结果/错误/是否等待自动重试/手动重试（AppBoot 的库打开、版本、导入三件事闸门；库打开失败按 1s 起指数退避最多 5 次，成功后清除错误）；`usePersistedValue(key)` 转出值 + `loadStatus`（loading/ready/error）+ `saveStatus`（idle/pending/saving/error）+ 重试，供局部区块骨架与错误卡驱动
- `use-theme-switch.ts` — 明暗三选项唯一来源：`THEME_ROWS`（值/文案/图标表，新增档只改这里）+ `useThemeSwitch()`（返回乐观优先的 `shown` 与 `switchTo(next, at?, settleMs?, floorMs?)`：起点取点击处、拿不到坐标落视口中心、`settleMs` 让事务等游标滑到位再启动、`floorMs` 是滑行结束后再等一拍的下限（浮层收掉用）、生效明暗未变则只落状态不起全屏动画、失败回滚、连点作废过期事务、接受选择时先 `cancelSystemTransitions()` 作废待播的系统抖动）；`startThemeTransition` 的唯一手动调用方；控件形态不在这里，在 `components/option-switch.tsx`

shortcuts/：
- `registry.ts` — 快捷键单一来源：条目含 combo 结构、生效端、类别；`comboText/entryText` 派生展示串，`comboMatches` 供匹配，`effectiveShortcuts/shortcutById` 供安装与设置页（键位字面量只出现在这张表里）
- `sidebar-hotkey.ts` — 三态循环热键（组合键取自 registry；注册表内置的两态 Ctrl+B 已移除，不再抢事件）
- `content-split-hotkey.ts` — 内容区右栏/底栏收起切换热键（组合键取自 registry，行为与标题栏按钮共用 `store/content-split`）
- `webview.ts` — 守卫安装器：拖入拦截常驻，block 类与 hotkey 类条目全部由清单驱动（行为表按 id 挂钩）

lib/：
- `tauri/index.ts` — Tauri 能力唯一入口：`IPC`/`IPC_EVENT` 常量表（命令与事件名不再散写）+ 窗口操作/置顶/sidecarToken（仅缓存非空结果）/终止事件订阅 + `useWindowState` 单例快照（只剩最大化标志，圆角不在此处）
- `radius-channel.ts` — 圆角通道：把四角半径合成 border-radius 串写到文档根供全树继承（`publishRadius(corners, maximized)`）；只出值不挂标记——最大化输出 `0`，其余桌面/web 同一套值，形状与裁切由 index.scss 的 `html, body` 静态规则消费
- `backend.ts` — 后端目标单一来源：`apiUrl` 拼址、`authHeaders` 注令牌、`treatyRequest` 供 Eden；形态判据只在这里
- `api.ts` — Eden 客户端（消费 backend）；`chat.ts` — AI SDK transport + `requestTitle(messages, withProject)` AI 命名请求（消费 backend，fetch 白名单；返回 `ChatTitles` 双字段各自可 null，失败静默回落）
- `sidebar-channel.ts` — 侧栏宽度通道：把 `--sidebar-width` 发布到文档根（`publishWidth/readWidth/nextWidth` + 可拖区间 `WIDTH_MIN`/`WIDTH_MAX`），使侧栏、画布、body Portal 的悬浮侧栏继承同一个值；宽度上下限在此单源，拖拽与持久化收敛共用
- `route-history.ts` — 路由历史位置（全应用唯一读 `history.state.idx` 的地方）：只记上一条条目号 + 前进上界，`observePath()` 给出历史穿越方向与是否穿越，`subscribeHistory/historySnapshot` 出前进后退可用性；菜单点击的方向由 page-track 按槽位定
- `storage.ts` — 持久化唯一门面（Dexie/IndexedDB，库名 `aigc-web`）：`records` 单表（主键 `key`，索引 `updatedAt`/`dirty`，每条带脏标记与内容更新时间供后续增量同步）；`STORAGE_KEYS` 登记全部逻辑键（含第三方库自管的键，只做索引不接管）；启动链路 `initStorage` 阶段化（打开→申请持久化许可→版本检查→幂等归一→首次 localStorage 全量导入→全量装载内存镜像）；内存为真源，`readText` 只读镜像，`readTextSync` 供启动闸门放行后的首帧同步取真值（未装载返回 null），`writeText` 先内存后按键防抖（关键键 0ms / 中频偏好 300–400ms）并单事务 `bulkPut`/`bulkDelete` 批量提交；状态 `idle/pending/saving/error` 对外订阅（`pending/saving/error` 暴露给界面）；失败 requeue + 指数退避重试（上限 5 次）+ DEV 日志；写入前 `navigator.storage.estimate` 预判配额，空间不足降级为未落盘不抛；`BroadcastChannel` 广播变更键 + 回查 DB 刷新镜像做跨窗口同步（本地未落库键不被远端覆盖），`notifyKey` 区分来源（local/remote）并经 `subscribeStorageChange` 统一外发；主题首帧提示 cookie 只在此写入，`pagehide`/`visibilitychange` 自动 flush；`storageAdapter` 供 zustand persist，`src/dev/layer-inspector.ts` 是唯一豁免（可整体拷走的零依赖单文件，位置存储由宿主注入）
- `store-sync.ts` — 跨窗口 store 同步唯一登记处：`STORAGE_KEYS.ui/auth/projects` → 对应 store 的 `persist.rehydrate()`（rehydrate 走内部 set 不触发 setItem，天然无回环）；只处理 remote 来源；出现形如 `{state, version}` 却未登记的键在开发环境告警一次
- `glass-channel.ts` — 个性化旋钮通道：把 `--glass-blur`/`--film-a`/`--wash-a` 发布到文档根（`publishGlass`），内容面着色与模糊、衬层径向晕染只读这三个令牌，平台无关
- `motion.ts` — 动效单源 = anime.js 唯一入口（动画库懒加载 `import("animejs")`，首屏主包不含）：`useMotionScope(root, register)` 返回 `{ scope, ready }`（官方 createScope 生命周期，卸载 revert；异步就绪后调用方按 ready 补播）、`revealStagger` 错峰挤入、`shake` 抖动反馈、`prefersReducedMotion` 守卫（切页平移不走 JS，见 layout/page-track）。只做局部动画，页面禁止直接 import animejs 或写死数值
- `theme-transition.ts` — 主题切换事务 `startThemeTransition({apply, rollback, x, y, priority?})`：手动选择与系统明暗变化共用这一条圆形揭示链路，写 --vt-* 触发过渡，回调内只同步落 html class（新快照随后捕获）；优先级 user > system，同一时刻最多一条 VT，播放中到达的请求排队（手动后到覆盖先到、系统抖动只留最后一次）；`cancelSystemTransitions()` 供用户手动选择作废待播系统过渡；`onThemeTransitionStart(listener)` 在快照捕获前同步通知其它动效收敛、`isThemeTransitioning()` 供启动新过渡前自查；reduced-motion / 窗口隐藏 / 无 VT / `startViewTransition` 抛错一律直接切换（DEV 记跳过原因），提交半途抛错即回滚，`ready`/`finished` 的 reject 一律接住。反馈分层归调用方：按钮先切，事务延后一个任务
- `access.ts` — 权限判定单源（占位实现）：`RouteAccess{permission,label,demo?}` 挂在路由 `handle.access`；`permissionsOf(username)`/`currentPermissions()` 按登录用户名查 `PLACEHOLDER_GRANTS`（占位来源，未登录用 guest，`"*"` 全放行），`canAccessWith(access, owned)` 纯判定、`useAccess()` 响应式入口；未声明权限的路由默认放行，菜单可用性与页面准入共用这一份判定，正式接入角色体系时只替换 `permissionsOf()`

## src-bun/（Bun + Elysia；桌面本地服务 / 服务器部署两形态，靠令牌区分）

- `app/index.ts` — 应用组装入口（AOT 指向）；`app/cluster.ts` — 进程管理入口（宿主启动它，集群 worker 跑同目录 `index.js`）
- `app/common/` — `index.ts`（`$g` 聚合导出：mysql/pg/sqlite ORM、redis、logger、res/ctrl/success/error，生成的 routes.ts 以此消费）、`tauri_sidecar.ts`（桌面令牌/宿主 PID 配置，token 非空=本地模式）、schemas/schemaDerive/init-global
- `app/controller/api/` — 公共路由 `/api/**`（chat、title）；`app/controller/system/` — 本系统专用 `/system/**`（`system.ctrl.ts` 服务自检 ready/all_perm；`auth/auth.ctrl.ts` 注册/登录/刷新/登出/me/孤儿权限编号）；`app/controller/test/` — 测试路由 `/test/**`（框架响应测试 + mysql/postgresql/sqlite 方言测试）；`app/controller/offline/` — 桌面专属 `/offline/**`（服务器形态一律 404，门控在 `app/plugins/controller.plug.ts`）
- `app/lib/` — mysql/index、postgresql/index、sqlite/index（各方言连接，均为 `client` 具名导出 + 默认导出；mysql 用 mysql2 池 / postgresql 用 Bun.SQL / sqlite 用 bun:sqlite，WAL 与 `foreign_keys=ON` 在连接层开启）/ redis/index（客户端）/ logger / error / auth（config 环境配置、password 密码哈希、token JWT 与 refresh 摘要、session 会话签发轮换撤销、access 用户权限缓存与资料、seed 内置角色）；`app/model/` — 按方言分目录（mysql/postgresql/sqlite，各含 `db.ts` + `relations.ts` + `*.mold.ts`）+ `describe.ts`（字段描述注册表，`description(table)` 自动取表名并注入 OpenAPI），经 `$g.mysql` / `$g.pg` / `$g.sqlite` 使用；SQLite 已含 user / role / user_role / role_permission / session 五张 RBAC 表
- `app/plugins/` — 控制器注册 / macro（`perm` 宏内校验：闭包编号 + 用户权限缓存，`title`/`desc`/`res` 元数据）/ schema / auth（全局 derive 解析 Bearer 令牌得到 `authUser`）插件
- `utils/` — 通用工具：file / watch / menu-ui / mergeDeep / counter（只读自增计数器）/ env_handle（环境变量读取与校验），独立于 app 业务层，根构建脚本也直接复用；`generate/` — 代码生成工具（routes 路由聚合 / batchExport 批量导出 / genApiTypes 声明式类型树），由 `system/script/index.ts` 调度
- `config/` — 集中配置：`env.ts`（环境变量统一入口 `ENV`，键名与 `.env` 变量同名同大小写，只收 src-bun 模块自身消费的变量，默认值只写在 `.env`，必填项缺失即报错；读取/校验通用逻辑在 `utils/env_handle.ts`；src-bun 之外的根脚本直接读 `process.env`）、`auth.ts`（认证运行参数：权限缓存 TTL/条目上限、过期会话清理间隔）、`bunfig.toml`（Bun 运行/安装，所有 bun 脚本用 `--config` 指定）、`biome/biome.jsonc`（代码检查与格式化，`fix` 用 `--config-path` 指定，`files.includes` 排除 `runtime`）、`drizzle/<方言>.ts`（迁移配置，schema 指 `app/model/<方言>/**/*.mold.ts`，产物落 `runtime/generated/drizzle/<方言>`，SQLite 仅取 `SQLITE_DATABASE_PATH` 无默认，路径相对包根解析）；`tsconfig.json` / `.npmrc` / `.gitignore` 因工具固定从包根读取而保留原处
- `system/script/` — 命令与构建入口：`index.ts`（dev 生成入口：调度 `utils/generate` 的 routes/batchExport/genApiTypes，配置了 `GEN_API_OUT_DIR` 时输出 Eden 类型树，留空自动跳过）/ `build.ts` / `build_tauri_bun.ts`（产出本地服务 JS 产物，不内嵌运行时）/ `menu.ts`（交互式命令菜单）
- `runtime/` — 运行期产物目录：`generated/` 全部派生产物（勿手改，按用途分目录）：`routes.ts`（路由聚合）/ `model/schema.ts`（elysia 模型注册表）/ `model/<方言>/index.ts`（表聚合）/ `drizzle/<方言>/`（迁移产物）；`database/` 运行期数据目录（SQLite 库文件，路径取 `SQLITE_DATABASE_PATH`）；`logs/` 运行日志（logger 默认目录）
- `system/types/` — `global.d.ts`：`$g` 全局声明（genApiTypes 显式纳入）
- `public/` — 服务静态资源（目录取 `STATIC_DIR`，必填无默认）
- 产物树 `dist/`：主程序 `aigc.exe` 在根，服务相关全部在 `bun/` —— 入口 `cluster.js`（宿主启动的进程管理入口）+ `index.js`（AOT 应用入口 / 集群 worker 入口）+ `chunk-*.js`（代码分割共享块）+ `.env` + `bunfig.toml`（构建期从 `config/` 取，落产物根）+ `${STATIC_DIR}/` + 随包运行时 `bun.exe`/`bun`（构建期从构建机复制，运行期优先使用、缺失才回落 PATH），入口各带 linked `.map`；纯 JS 打包不编译运行时，由 Rust 以该目录为 CWD 启动

## src-tauri/（Tauri v2，Rust 桌面壳）

- `tauri.conf.json` — 窗口（无装饰/透明/无 OS 阴影与边框/最小 375×667）/ devUrl / bundle（不含 externalBin）
- `build.rs` — tauri_build + `rerun-if-changed=icons/icon.ico`（图标编译期嵌 exe，tauri-build 不 watch 图标，补 watch 后改图标即重嵌）
- `Cargo.toml` — `[features] devtools`（dev 由 scripts 传 `--features`，release 不含 DevTools；cfg(debug_assertions) 不能用于选依赖）；`[lib] crate-type = ["rlib","staticlib","cdylib"]`（桌面 rlib、iOS staticlib、Android cdylib）；windows/webview2-com 仅 Windows target；ureq/dotenvy/chrono 仅在非 Android/iOS target 编译（本机退出通知、端口读取、终端日志分天；移动端无本地服务）；panic=abort
- `capabilities/default.json` — 窗口权限白名单（minimize/toggle-maximize/close/start-dragging/set-always-on-top/set-theme；show 已由 Rust 侧 reveal_window 承担，不再开权限）
- `app-icon.png` + `icons/` — 全端图标（app-icon.png 为源图、自身已带 7/32 等比圆角，改动后 `bunx tauri icon app-icon.png` 重生成再跑 `python scripts/round_icons.py`；全平台 PNG/ico/icns 均圆角透明角；android 自适应图标最终形状仍归系统遮罩（前景圆角+背景透明），ios 为预圆角（上架 App Store 需按苹果规范换回全幅方形））
- `src/`：
  - `main.rs` — 入口（release 无控制台）
  - `lib.rs` — Builder：插件（window-state/single-instance）+ setup（桌面 release 拉起本地 bun 服务、WebView2 非客户端区转发、5s 强显兜底）+ 命令注册 + `RunEvent::Exit` 退出通知（以上两处均 `cfg(desktop)`，移动端不编译）
  - `commands.rs` — IPC：`sidecar_token`（未就绪返回空串，移动端恒为空）/ `reveal_window`（就绪信号，动作在 lib.rs `present_window`）/ `shell_platform`（Rust cfg 平台标识）
  - `sidecar.rs` — 本地 bun 服务生命周期（仅桌面 release）：随包 `bun bun/cluster.js` 命令启动（CWD 为 bun 子目录）、注入令牌与宿主 pid、stdout/stderr 逐行写终端日志、置位/清零 SidecarReady、退出调 `/offline/exit`、意外退出 emit `sidecar-terminated`
  - `sidecar_terminal_log.rs` — 终端日志写入器（仅桌面 release）：按本地日期追加 `bun/logs/bun_terminal/年-月-日.log`，跨天自动切文件，写入失败仅提示一次
  - `state.rs` — 托管状态：SidecarToken / SidecarReady（进程起来且未退出才为真）；Rust 不持有圆角状态，四角真值在 src-web `store/ui.ts`

## 跨模块契约速查（改动时任一端必查另一端）

| 契约 | 两端 |
|---|---|
| invoke：`sidecar_token` `reveal_window` `shell_platform` | src-tauri/commands.rs ↔ src-web/lib/tauri（`IPC` 表；`bun run check:ipc` 校验） |
| 事件：`sidecar-terminated` | src-tauri emit ↔ src-web listen（`IPC_EVENT` 表；同上校验） |
| env：`TAURI_SIDECAR={"token":...,"pid":...}`（启动，pid 供探活） | src-tauri/sidecar.rs ↔ src-bun/common/tauri_sidecar.ts |
| 退出：`POST /offline/exit` + `x-tauri-token` 头 | src-tauri/sidecar.rs（RunEvent::Exit） ↔ src-bun/controller/offline/exit.ctrl.ts |
| 应用标识与名字 | tauri.conf.json `productName`/`identifier`（AIGC / com.aigc）＝窗口标题、可执行文件名与数据目录（`%APPDATA%\com.aigc`、WebView2 profile）；web 侧另有 `index.html <title>` 与 `brand-logo.tsx` 的 `BRAND_NAME`；改标识=换数据目录，旧数据不迁移 |
| 令牌语义：非空=本地服务进程已起来且未退出 | src-tauri/SidecarReady ↔ src-web/lib/backend（请求头）↔ src-bun/controller.plug（校验/门控） |
| HTTP：`/api/**` `/offline/**` | src-bun 控制器（offline 按令牌 404） ↔ src-web/lib/backend（apiUrl+authHeaders） |
| 侧栏宽度通道 `--sidebar-width` | src-web/lib/sidebar-channel.ts 单点发布（文档根）→ 侧栏/画布/悬浮侧栏/index.scss 兜底 |
| 内容面偏移 | src-web/components/layout/page-canvas.tsx 的 `surfaceLeft(mode, desktop)` |
| 圆角 | 四角半径真值在 src-web `store/ui.ts`（默认 7=RADIUS_DEFAULT；index.scss `--app-radius` 兜底恒取 0，真值由通道在首绘前写入）→ `lib/radius-channel` 只把值写进文档根 `--app-radius`（未最大化输出四值、最大化输出 0，桌面与 web 同值）；形状与裁切是静态规则 `html, body{border-radius:var(--app-radius);overflow:hidden}`（用户实测生效档，两层盒重合：body 无 margin 与 html 同原点同尺寸，故无逐角递减；原点不同的层——壳根/登录页根/页面组件——一律禁止再画圆角）；`[data-app-edge]` 描边与 `::view-transition` 底色层只是按同一变量画线/画底，不额外裁切。Win 侧 setup 设 `DWMWCP_DONOTROUND` 关掉系统 8px 裁切，其余平台无分支 |
| 个性化旋钮 `--glass-blur`·`--film-a`·`--wash-a` | src-web `store/ui.ts`（个性化设置）→ `lib/glass-channel.ts` 单点发布到文档根 → index.scss 内容面着色规则 + 衬层径向晕染（`--wash-a` 为 0 即整体关掉背景渐变）；衬层壳色恒实心，与平台无关 |
| 持久化键清单 | src-web/lib/storage.ts `STORAGE_KEYS`（store/theme/项目数据/设置页分栏/内容区分栏/检视器位置唯一登记处，新增必须登记且键值不可再改） |
| 路由权限声明 | src-web/routes/registry.ts 的 `handle.access`（唯一声明处）↔ src-web/lib/access.ts 的 `useAccess`/`canAccessWith`（占位来源 `PLACEHOLDER_GRANTS`，正式鉴权只替换 `permissionsOf`）↔ sidebar-body 菜单可用性 + page-track 页面准入（同源派生，避免菜单与页面两套判断） |
| 出场时机（启动最小化 → 首屏还原聚焦） | src-tauri/lib.rs setup + `commands::present_window` ↔ src-web/components/layout/window-bootstrap.tsx |
| 系统材质（已撤销） | 不用 `windowEffects`/`set_effects`：材质连带 DWM 投影与 1px 框线且关不掉；磨砂一律 src-web CSS（见「个性化旋钮」契约行） |
| 移动断点 768 | src-web/hooks/use-mobile.ts ↔ index.scss `--breakpoint-md`/媒体查询（壳最小 375×667 见根 AGENTS） |
| devUrl | scripts/config.ts ↔ src-tauri/tauri.conf.json |
| 快捷键清单 | src-web/shortcuts/registry.ts（键位/展示/安装唯一来源，新增必须登记） |

## 维护规范

- 结构变化 = 代码 + 本文件同一提交更新；漏更视为改动未完成
- 新增模块/目录：先定职责归属（各模块自查、互不牵扯），再登记条目
- 命名沿用现有约定：`src-*` 顶层模块；web 内按职责目录（layout/routes/store/hooks/shortcuts/lib）
