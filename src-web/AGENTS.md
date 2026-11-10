# 规则
- 摇树：对于支持按需导入和摇树的，必须使用按需导入和摇树，避免全部导入。
- ！组件化：能独立成组件的必须组件化（单一文件包含所有内容，除非有共用的样式或逻辑才拆分），提高复用率，减少重复代码。
- 光标：注意根据场景和元素切换合适的光标样式。
- 屏幕适配：注意需要兼容不同设备屏幕尺寸（如手机、平板、PC 等尺寸），避免在不同设备上显示异常。
- 滚动归属：禁止整窗/文档级滚动（html/body/#root overflow 恒 hidden，见 index.scss 裁切规则），滚动只允许区域级容器——壳内一律官方 ScrollArea，AppShell 之外的全屏页自带 `h-svh overflow-y-auto` 滚动盒；禁止调用 `window.scrollTo`/`documentElement.scrollTop` 等文档滚动 API，也不得用 min-h-svh 把撑高推给文档。
- 状态持久化：全模块唯一持久化层是 `lib/storage.ts`（Dexie/IndexedDB：库定义、表与索引、幂等迁移、异步读写、按表批量提交、重试、跨窗口同步都在此）。持久化键一律登记在 `STORAGE_KEYS`（值一经发布不可再改，改了等于丢用户数据），组件与 store 里禁止写键名字面量；读写只走异步 `readText`/`writeText`（`writeText(key, value, { immediate: true })` 可跳防抖，`flushStorage` 立即批量提交，页面隐藏/卸载自动 flush；内存为真源，失败降级为 pending/error 并重试），zustand persist 一律经 `storageAdapter` + `skipHydration`，由 `components/app-boot.tsx` 在库装载后统一水合；页面读取的加载/保存态走 `hooks/use-storage.ts`；禁止直连 IndexedDB/localStorage/sessionStorage（ESLint 兜底，仅门面保留首次历史导入与主题首帧 cookie）；第三方库自管的键只做索引登记、不反向接管（`dev/layer-inspector.ts` 零依赖单文件经注入存储是唯一豁免）。
- 体验优化: 合适场景主动优化应用体验（视觉、转场、反馈、手感…），按场景挑选最合适的实现方式；取向优先 View Transitions 与 anime.js，细则见 src-web/AGENTS.md「动效与体验优化」。
- 动画局部性: 动画只动组件/内容块，禁止整窗位移与整页淡入淡出；切页一律用内容区轨道平移（轮播式，靠 `layout/page-track.tsx` 的 DOM 轨道实现，标题栏与侧栏不参与，非当前页冻结保活），主题切换是唯一允许全屏呈现的动画。
- CSS优化：优化渲染性能和使用体验（体验收益优先），如 content-visibility、contain、 will-change、...。
- 懒加载：对非媒体资源和大型资源进行懒加载，优化加载速度避免阻塞页面加载和渲染，保证应用体验。

Tailwind：
- 如果需要复用类名提取为常量，命名以 Class/Style 结尾（IDE 补全依赖此后缀），定义与.vscode/settings.json。
- 条件组合用 cn() 或 className 内三元。
- 禁止变量拼接类名，动态类必须写完整字面量。
- 覆盖 shadcn 组件内部默认类必须带同变体全类名（如 `group-data-[side=left]:border-r-0`），裸类名赢不了 tailwind-merge。
- icon 一律经统一入口显式尺寸（`size` 默认 24 对齐 lucide-react；chrome 调用点显式 16/14），不依赖组件的 `[&_svg]` 后代规则。

图标：
- **使用优先级（逐级往下判，上级有对应图标就用上级）**：① **react-useanimations**（官方 `@useanimations` shadcn registry 件；`AppIcon` 自动路由，`AnimationIcon` 为显式入口）→ ② **lucide-react 静态**；缺对应才降级；禁止自绘 SVG 图标。本阶梯为图标专用规则，UI 组件仍走下方 shadcn 生态阶梯。
- **动效白名单（当前定档，① 级只登记这五件）**：新建项目 `edit`、明暗三档 `sun`/`moon`/`monitor`、加载 `loadingV2`；其余图标一律 ② 级静态。扩动效需先 `shadcn add @useanimations/<name>` 再补 `UaName`/`UA_SET`/`UA_ICONS`/`UA_OPTICAL_SCALE` 四处登记。
- 统一入口 `components/icons.tsx`（`AppIcon`/`AnimationIcon`）；业务代码禁止直 import 图标库（登记表内部除外）；新增图标先查 lucide-react 再补登记表一行，登记表只登记在用图标（摇树）。
- 尺寸走 `size` 参数、className 只接颜色/布局；lottie 分支懒加载独立 chunk，懒加载期回落同名静态图标。
- 加载动画优先 `loadingV2`（useanimations loading-v2，`interaction="loop"`）；禁止再用 Spinner/Loader 类静态转圈做加载态（ui/spinner 官方件保留但业务不引）。
- 光学归一：UA 逐图标系数表 `UA_OPTICAL_SCALE`（animation-icon.tsx，实测占盒比推导）+ `--icon-stroke` 描边反补；容器盒=内层盒、aspect-square 锁正方不变形；新增/换图标后走 dev 审计页 `#/dev/icons` 目检 parity 再回改系数表。

！shadcn ui：
完全接纳和使用 shadcn 系列的官方全生态，包括组件、主题、插件、...等，尽量避免自己实现和使用其他组件库！！！
在编写时需要特别注意主题相关，保证有效果。
- **生态优先级（选型阶梯，逐级往下判，不许跳级）**：① **shadcn 官方 registry**（`ui.shadcn.com`，含 `message`/`message-scroller`/`bubble`/`trace`/`attachment`/`marker`/`code-block`/`item`/`field`/`input-group` 这批聊天与表单原语）——官方有就用官方，`shadcn add` 后直接使用；② **AI Elements**（`@ai-elements` registry，真值在 components.json 的 `registries`，可安装 30 条，全是 AI 向）——仅当官方确无对应物、且要解决的正是 AI 产品语义（工具调用 `tool`、运行态 `task`/`queue`/`context`/`controls`/`connection`、推理链 `reasoning`/`chain-of-thought`、来源引用 `sources`/`inline-citation`、预览与画布 `web-preview`/`canvas`/`artifact`/`code-block`、流程图 `node`/`edge`、模型选择 `model-selector`、检查点/确认 `checkpoint`/`confirmation`）时才取；③ 自建组件，只在①②都无物时才允许，且必须说明为什么前两级不行。两级冲突时（同一功能官方也有）一律留官方、删 AI Elements 那份。
- ！组件清单地址（选型时直接抓，别靠记忆；条目数量随上游变动，以抓取当日为准。以下 pattern 已逐条验通，标注 ✗ 的是踩过的错写法，别再试）：
  - **官方 shadcn**
    - 可安装总清单 `https://ui.shadcn.com/r/index.json`＝数组，一条一个可安装项，每项带 `files` 与 `meta.links.{base,aria,radix}`（三种实现的 docs/examples/api 地址）。
    - 单项 **必须带 style 段**：`https://ui.shadcn.com/r/styles/{style}/{name}.json`（style 取 components.json 的 `style`，本项目 `base-nova`；已按 index.json 全 65 项逐个验通）。✗ `https://ui.shadcn.com/r/{name}.json` 恒 404。
    - style 自身 `https://ui.shadcn.com/r/styles/base-nova/index.json` 是 `type: registry:style` 条目（依赖表 + `cssVars` + `css`），**不是组件清单**，别拿它数组件。
    - 仓库侧 `shadcn-ui/ui@main`：清单源文件 `https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/lib/components.ts`（`UI_COMPONENTS`，比 index.json 多 3 项仅文档件）；实现源码 `https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/registry/bases/base/ui/{name}.tsx`（Base 档，即 base-nova 的上游形态——仓库里**没有** base-nova 源码目录，它由 transform 生成，✗ 把路径里的 `bases/base/ui` 换成 `base-nova/ui` 恒 404）。
    - 人读：`https://ui.shadcn.com/docs/components`、单件 `https://ui.shadcn.com/docs/components/base/{name}`（另有 `/aria/{name}` 档）。
  - **AI Elements**
    - 总清单 `https://registry.ai-sdk.dev/registry.json`＝`items` 两类混排：组件条目与 `example-*` 演示条目（判数量要先滤掉 `example-` 前缀）。✗ `https://registry.ai-sdk.dev/index.json` 恒 404。
    - 单项 **直接平铺、无 style 段**：`https://registry.ai-sdk.dev/{name}.json`（name 必须取 registry.json 里的组件名，例 `tool`、`reasoning` 已验通；官方件的名字在这儿取不到，如 `message-scroller` 会 404）。本项目 components.json 的 `@ai-elements` 就指这个域名，写法与官方不同。
    - 仓库侧 `vercel/ai-elements@main`：`https://raw.githubusercontent.com/vercel/ai-elements/main/packages/elements/src/{name}.tsx`——**HEAD 与已发布 registry 双向不同步**（HEAD 有一批源文件尚未发布，registry 里也有 HEAD 查不到的名字），判「有没有」以 registry.json 为准，判「怎么实现」以源码为准。
    - 人读：`https://elements.ai-sdk.dev/components`。
  - **Kibo UI**（选型阶梯之外的通用富媒体/画布类参考，非本项目在用）：总清单 `https://www.kibo-ui.com/r/registry.json`（条目把整份源码内联在 index 里）。✗ `https://www.kibo-ui.com/r/index.json` 恒 500。单项 `https://www.kibo-ui.com/r/{name}.json` **只对它自有的条目通**，它 `registryDependencies` 里引用的官方件名（`tooltip`/`button`…）在那儿取不到，会 500。
  - 两边 `meta.links` / registry 条目里的 `registryDependencies` 是**通用名**，装到本项目会按主注册表解析成 Radix 版并覆盖本地 Base 件——抓取时先看这个字段，取法见下条硬约束。
- 颜色一律语义令牌；新增色值走 CSS 变量（`:root`/`.dark` 双份 + `@theme inline` 注册，参照 `--shell`）。禁止硬编码单主题色衬在随主题 surface 之下：暗色令牌多为半透明白（如 `--border`），衬浅色底会恒显白线。唯一白名单例外：Windows 关闭键悬停红 `#E81123` / 按下浅红 `#F1564C`（系统原生色、不随主题变，见 `components/layout/window-controls.tsx` 注释），其余色值不得硬编码。
- 图标按钮一律 `components/layout/icon-action.tsx`（= chrome 态色 Button + 下方 Tooltip）；禁止再各自展开 Tooltip 三件套。要做下拉/菜单触发器时不换外壳：`button={{ render: <DropdownMenuTrigger /> }}` 组合，Tooltip 仍由 IconAction 负责。选中态用 `aria-pressed`（开关）/`aria-current`（导航），侧栏条目选中由 index.scss 层外 `[data-active]` 加深，悬停色复用 `--sidebar-accent: var(--chrome-hover)`。
- 官方组件优先（硬规则）：写 UI 前先按上面「组件清单的机器可读地址」抓官方清单，官方已有的必须 `shadcn add` 后用，禁止手写等价 div/kbd/pre 变体。官方无对应物 → 按选型阶梯降到次选 `@ai-elements`（限 AI 语义件），两级都无物才允许自定义：Tauri 窗口层（title-bar/drag-region/window-controls/window-pin）、page-canvas 背景层、sidebar-resizer（官方 Resizable 只服务 panel-group，驱动不了 fixed 侧栏的 `--sidebar-width`）、brand-logo、theme-provider/transition（官方是文档片段非 registry 项）、React Flow 画布。`typography`/`data-table`/`date-picker` 官方仅文档、不可安装（在仓库清单 `UI_COMPONENTS` 里，但不在 `r/index.json`）。
- 官方磨砂规则会波及的自定义表面需显式退出：流程节点 `[data-slot=card][data-flow-node]` 关 blur（拖动掉帧）。Sheet/Dialog/画布锚点都在 provider 子树之外（body Portal / 壳根），**provider 里定义的 CSS 变量它们取不到** → 宽度一律走 `lib/sidebar-channel` 发布到文档根，不再逐处 inline 补丁。
- 所有覆写注册表内部的层外规则集中在 index.scss 的「注册表覆写契约」一节，条目已编号；`shadcn add --overwrite` 或 Base UI 升级后按该清单逐条复查是否失效。
- 文字渲染：`html` 上统一 `-webkit-font-smoothing: antialiased` + `font-synthesis-weight: none`（Geist 有真字重，禁合成假粗）+ `font-kerning: normal`；正文色用近黑 `--foreground`（亮档 0.21，非纯黑），新增文字令牌一律别名到它，禁止再写 `oklch(0.145 0 0)` 一类的第二份黑。
- 外壳/布局无边框：不写 border 类，边界视觉用恒显浅色拖拽细线（不随悬停/拖拽变色）或底色差。
- 表单校验用 `Field data-invalid` + 控件 `aria-invalid` + `FieldError`，手写校验状态，不引入 react-hook-form/zod。
- 聊天 UI 骨架恒用官方原语（`message-scroller`/`message`/`bubble`/`trace`/`empty`/`input-group`）：滚动跟随、消息行、活动轨迹官方已内置，禁止再引入 `@ai-elements` 的 `conversation`/`prompt-input`（会带进 `use-stick-to-bottom` 与第二份输入条，与官方重复）。
- 取次选（`@ai-elements` 条目）时的四条硬约束：① **只单件安装**，禁止批量 `add`；② 条目的 `registryDependencies` 指向通用名（`button`/`collapsible`/`command`/`dropdown-menu`/`hover-card`/`input-group`/`select`），默认会解析成官方 **Radix 版**并把本项目 `components/ui/` 的 Base 版覆盖掉——装前改指本地同名件或先 `--dry-run` 看清受影响文件，装后逐个复查；③ 条目自带的 npm 依赖要补进 package.json（按条目而定，实测命中过：`streamdown`、`use-stick-to-bottom`、`nanoid`、`@radix-ui/react-use-controllable-state`；`ai` 已有），不装就是坏引用；④ 装进来的文件走本项目别名与语义令牌复查（`@/components/ui/*`、`cn()`、禁止硬编码色值），AI Elements 原生的字符串前缀与自定义类不保留。

背景系统（独立性铁律）：
- 背景独立性: 窗口层与主干容器链一律零背景，背景色只允许页面级/分支组件自带;
- 主干链零背景：窗口→html/body/#root→壳根→provider→行→标题栏→侧栏→inset→页面根全链路不着色。三层由 index.scss 层外 `!important` 锁死；窗口靠 `transparent:true`。
- 主题必须同时声明 UA 着色方案：`html{color-scheme:light}` / `html.dark{color-scheme:dark}`。主干透明 ⇒ 整窗圆角、Win11 窗口圆角等「未被自绘覆盖」的像素由 UA 默认画布填充，缺它暗色下顶边整条发白（滚动条/表单控件也恒亮）。
- 窗口描边归 web：conf 已关 `decorations` 与 `shadow`，OS 不画线也不画阴影 → 壳根末尾 `[data-app-edge]` 用 `--edge` 自绘 1px inset 描边（半径取 `--app-radius` 通道值、`pointer-events:none`、仅桌面渲染）。已知差异：悬浮侧栏 peek 是 body Portal（z-50），展开时压住左缘那 1px。缩放热区为窗口最外约 4 CSS px（`SM_CXFRAME/CYFRAME`），贴边可点控件一律留 ≥8px——现有标题栏/侧栏内缩已满足，纵向滚动条贴右缘属已知风险点。
- 圆角单源：四角半径是**用户设置**（`store/ui.ts` 的 `corners`，0–`RADIUS_MAX`，0=直角，默认 7），`lib/radius-channel.publishRadius(corners, maximized)` 只把它合成一组值写进文档根 `--app-radius`（桌面与 web 输出同一套值，只有最大化归零）；形状与裁切是 index.scss 的一条静态规则 `html, body{border-radius:var(--app-radius);overflow:hidden;transition:border-radius 160ms}`，无属性标记、无 JS 挂标记。两层同值的前提是**盒完全重合**（body 由 preflight 去 margin，与 html 同原点同尺寸）——原点不同的两层（壳根、页面根）一律禁止再画圆角，两层矩形相交会把不到 1px 的框偏差放大成逐角递减的弧，组件内也禁止写 inline `borderRadius`。web 档同样裁切（露出的是 UA 画布色，不是桌面）。`[data-app-edge]` 描边与 `::view-transition` 底色层读同一变量只用于画线/画底，不额外裁切。禁止另起一条 Rust 圆角链路：Win11 那圈约 8px 系统裁切已由 Rust setup 设 `DWMWCP_DONOTROUND` 关掉，曲线彻底归 CSS。
- 主题落地时同步一次原生明暗 `lib/tauri.setWindowTheme(dark | null)`（仅 Windows，供 DWM 缩略图/Alt-Tab 着色；mac/linux 传明暗会污染 `prefers-color-scheme` 判定）。**跟随系统档必须传 `null`**——传显式值会被 Tauri/tao 写进 WebView2 的 `PreferredColorScheme`，页面 `prefers-color-scheme` 被钉死、系统换色事件收不到。
- 背景是页面级资产：每页自带 `<PageCanvas>`（衬层 bg-shell 壳色+噪点晕染、内容面半透壳色 76% + blur12 磨砂、左上内圆角走 `--surface-radius` 令牌、top-titlebar 让位标题栏带；点状 `.bg-dots` 与光晕 `.bg-gradient` 仅登录页（光晕是 `public/bgrgb.png` 位图，由 `.bg-gradient` 类引用），流程页用 React Flow 自带 Background；内容面的着色/磨砂/内圆角都在 index.scss 契约条目 3，组件里只写定位与 left）。锚点由本模块自持（`CanvasAnchor` 组件 + 模块内槽位 + useSyncExternalStore，不用 context/ref 转发），AppShell 只在壳根摆出锚点节点（absolute inset-0 -z-10 全窗），画布 createPortal 铺满含标题栏带——Portal 是绕开 `contain:paint` 封锁的既定手段，行 contain 不变量勿动。路由轨道保活多页时画布只归当前页（`CanvasOwner`，非当前页不铺）——内容面是半透的，叠两层壳色就比一层浓。
- 内容面偏移是 JS 事实：`page-canvas.surfaceLeft(mode, desktop)` 返回 `var(--sidebar-width)`/`var(--sidebar-width-icon)`/`0px` 并直写 style，index.scss 只留过渡与着色；不再挂 `data-sidebar-mode`，也没有 CSS 侧的三态分支。
- 允许着色层白名单：页面画布两层（衬层两处径向晕染受 `--wash-a` 开关缩放，关到 0 即只剩壳色+噪点）、悬浮侧栏 peek（chrome 72%+blur18）、卡片/下拉菜单磨砂（--card/--popover 40%+blur24，全局规则挂 data-slot）、登录页自有根与光晕层（`.bg-gradient`）、dev-only 检视面板（dev/layer-inspector.ts，release 不挂载）。除此以外禁止任何作用于全应用的背景。
- `dev/layer-inspector.ts` 必须零依赖（只用 DOM/CSSOM，不引 React、shadcn、本项目令牌），层级靠运行时 `getComputedStyle` 自动扫描（html、body 恒为最底两层）——新增自带背景的层无需登记；改它要保持「整文件拷进任意项目即可用」。它是独立使用的开发期工具、不属于组件体系，不参与组件化与复用合并（不适用「单一文件自包含、仅共用才拆分」），不得为风格统一改造它，也不接入 `components/ui`、`lib/`、`hooks/` 等通道。
- 移动抽屉例外：Sheet 保持 bg-sidebar 实底（透明规则仅限 ≥768px）。
- 过渡伪层例外：`::view-transition` 兜底色仅存于主题切换 300ms（见"桌面窗口与主题切换"）。
- 主窗口亚克力只做纯 CSS（各平台一致，不用系统材质——`windowEffects` 评估过已撤销，理由见 EXPERIENCES）：`page-canvas-shell` 实心 `--shell` + 噪点(inline svg feTurbulence) + 两处 `muted-foreground` 径向晕染；内容面 `--shell` 半透 + 自糊。
  - 三个旋钮单源：`--glass-blur`（内容面自糊半径）、`--film-a`（内容面壳色不透明度 %，默认 76）、`--wash-a`（衬层背景渐变 1/0，默认 1）；真值在 `store/ui.ts` 的个性化设置，由 `lib/glass-channel.publishGlass()` 发布到文档根。组件内禁止再写死 blur/alpha/晕染浓度，也不许按平台分支改背景；衬层壳色恒实心。默认档与上限（`*_DEFAULT`/`*_MAX`）连同 `resetPersonalize()` 都在 `store/ui.ts`，设置页滑杆不得再写字面数值。点状纹理不在此层（`.bg-dots` 仅登录页引用）。
- 淡出线单源：横竖各一条 `--line-h`/`--line-v`（1px、两端 4% 全透明、色取 `--separator`），SCSS 与 TSX 一律引用变量，禁止再展开 gradient 字面量；拖拽线恒显不变色。
- 标题栏带高度单源：`@theme --spacing-titlebar: 2.5rem` → `h-titlebar`/`top-titlebar`（壳根让位、内容面偏移、悬浮侧栏共用），新增让位处用该类，不再写 h-10/top-10/top-12。
- 断点单源：`--breakpoint-md: 768px`（Tailwind `md:` 的实值）+ SCSS 媒体查询写 768px + `hooks/use-mobile.ts` 的 768，三处同值，改断点必须三处一起动（JS 与 CSS 无法共享变量，靠注释互指）。

桌面窗口与主题切换：
- 桌面端任何页面必须保留最小化/最大化/关闭三键：AppShell 之外的全屏路由（如登录页）需自带 WindowControls + 顶部拖动区；圆角无需自管——`main.tsx` 挂的 WindowBootstrap 对全路由统一发布通道值。
- 主题切换动画只用 index.scss 的纯 CSS 方向规则（`vt-circle-in/out` + `--vt-x/y/r`，由 lib/theme-transition.ts 写参触发）；禁止改回「.ready 后 WAAPI animate」模式——过渡被跳过/拒绝时静默无动画。切换一律走 `startThemeTransition({apply, rollback, x, y, priority?})`：事务模块负责失败回滚、优先级排队与无 VT 降级，调用方只描述「切到哪」和「怎么退回」，禁止自己调 `setTheme` 再另起过渡。
- 系统明暗变化（`theme === "system"` 时 `matchMedia` 触发）必须复用同一条 `startThemeTransition`（`priority: "system"`、起点取视口中心），禁止另造第二套动画；同一时刻最多一条 VT，播放中到达的请求排队（系统抖动只留最后一次）；`prefers-reduced-motion`、`document.visibilityState !== "visible"`、无 VT 一律直接切换（隐藏期间不补播）；用户手动选择优先，`switchTo` 接受选择时先 `cancelSystemTransitions()` 作废待播系统过渡。固定档下系统变化只刷新 `systemTheme`，不动视觉；原生窗口仍按跟随系统传 `null`。
- 明暗是**三选项**（浅色/深色/跟随系统，存储值 `light`/`dark`/`system`）：选项表与切换事务唯一在 `hooks/use-theme-switch.ts`（`THEME_ROWS` + `useThemeSwitch()`），控件统一用 `components/option-switch.tsx`，**四处入口的接线统一经 `layout/theme-menu.tsx`**（标题栏与登录页顶栏窄档、设置页个性化带文案、侧栏用户菜单内嵌同一控件，靠 `onSlideDone`/`settleExtraMs`/`skipSame` 表达差异）。新增一档只改 `THEME_ROWS`，禁止在各入口再写一份文案/图标、各自调 `switchTo` 或自行起过渡；生效明暗没变（如浅色下选「跟随系统」而系统也是浅色）只落状态、不跑全屏动画。圆角判据：轨道固定 32px（模块常量，不可调），游标恒半圆端（给哨兵大值交由浏览器按自身半高截断），故两者不严格同心——属已确认取舍。形状只由「轨道 + 游标」两层表达：选项按钮必须保持透明（`aria-pressed` 底色要抵消），**不得用 `rounded-*` 自绘**；将来若给按钮留底色，必须写与游标同值的内联圆角，否则两层不同步。
- 游标滑行与主题切换**必须串行**：`switchTo(next, origin, settleMs)` 的第三参传组件导出的 `SLIDE_MS`（时长真值只在 `option-switch.tsx` 一处，页面不得另写数字）。等待判据是**游标自己的 `transitionend`（propertyName 为 transform）**，`SLIDE_MS + 150ms` 只当兜底上限——纯定时器会因掉帧、后台标签页停帧、过渡被浏览器跳过而与真实结束时刻错位，观感就是「卡一下」或「慢半拍」；`prefers-reduced-motion` 下 CSS 压平仍会派发 `transitionend`，等待自然归零，无需特判。生效明暗没变的那条路径不等动画，直接落状态。菜单内嵌那处两个条件都要满足：`switchTo(next, at, SLIDE_MS, MENU_CLOSE_MS)` 的第四个参数是「滑行结束后再等浮层收掉」的下限，收菜单本身排在 `SLIDE_MS` 上——单靠上限定时器会过早拍快照，把半开的菜单冻进旧画面。
- View Transition 期间文档渲染被快照树替换，`::view-transition` 必须保留 `var(--shell)` 兜底底色，否则透明窗口直接透见桌面；该底色矩形还要 `border-radius: var(--app-radius)`（圆角通道由 `lib/radius-channel` 单点写入），否则明暗切换的 300ms 里四角被填成尖角。
- 窗口出场时机归本模块：`layout/window-bootstrap.tsx` 在首屏 useEffect 里发 `reveal_window`（还原+显示+聚焦全在 Rust 一侧做完）。禁止改用 rAF/`onload` 等帧信号触发——窗口启动即最小化，WebView2 停帧时 rAF 永不回调，窗口会卡在不显示。
- 新增主题：在 html 层用类覆盖 CSS 变量（必须含 `--shell`），动画链路零改动即生效；html class 必须在 `startThemeTransition` 的回调内同步落，方向由目标是否带 `.dark` 决定。反馈分层：按钮图标/提示归调用方的乐观档（点击当帧生效），切换事务排到下一个任务——禁止在回调里 `flushSync` 整棵树（会把同步渲染压到快照捕获之前，更卡）。

动效与体验优化：
- 合适场景主动优化体验（视觉、转场、反馈、手感…），实现方式按场景择优，不默认沿用旧写法；取向：优先 View Transitions 与 anime.js。
- 场景→机制：主题切换（唯一必须全屏的 VT）→ 圆形揭示；路由切换 → 内容区轨道平移（DOM 轨道，种类由路由元数据声明，见下三条）；元素级编排（错峰、多步序列、弹性/可中断）→ anime.js；悬停、进出场、开关态 → CSS `transition`/`@keyframes`；滚动进度驱动 → CSS scroll-driven（`animation-timeline`）。切页一律不用淡入淡出。
- 动画局部性（硬约束）：动画只动组件/内容块，禁止整窗位移与整页淡入淡出。切页几何全在 `layout/page-track.tsx` + index.scss 的 page-track 一节：内容区最多 3 个页面槽（当前页居中，序号越大越靠左），槽 `left = -seq×100%`、轨道 `transform = translateX(当前seq×100%)`，换页只改位移目标 → 整条轨道平移一个槽宽，旧页右移出屏、新页从左侧紧贴移入，全程只动 transform、无透明度；标题栏、侧栏与内容区右栏/底栏始终原位。方向分两种来源，各只比一次：**历史穿越**（后退/前进按钮）比条目号——`lib/route-history` 记住上一条条目号，本次更小＝往左、否则往右；**菜单/链接点击**是新条目（条目号只会变大，只比历史就会永远往右），改比目标槽停在当前页哪一侧——左邻＝往右、右邻＝往左，没缓存过的新页一律往右，所以来回点两个菜单会左右交替。不按路径记账，同一路径在历史里出现多次也不误判；replace 停在同一条目沿用上次判定。全应用只有该模块读 `history.state.idx`，标题栏前进/后退可用性也从它转出。落位永远是当前页相邻的一格（多步后退也只走一格，绝不让中间页横穿屏幕），前翻作废被截断的前向槽。路由切页不用 VT——同名组的 old/new 快照叠在同一个矩形里，做不出「并排两页一起走」。淡入也不许落在自带不透明背景的页面根上（主干恒透明，半透明过程会透见桌面）。
   - 整页动 vs 局部动：默认**凡 hash 路由地址变化都整页平移**（pathname 与 `?query`／`#hash` 子地址一律成槽）。`routes/registry.ts` 每页的 `handle.motion` 就是动效档：`enter`（pan 默认；none 只作明确例外）、`query`（slot 默认＝每个完整地址各自成槽；local＝同路径不翻、只做页内局部动）、`reveal`（stagger／none）。目前唯一显式例外是设置页 `query: local`——分区是 replace 改的子地址（不占历史条目），且同页两份实例并挂会撞硬编码 id（`settings-nav`／`settings-content`／`glass-blur`／`radius-*`）并抢同一份 ResizablePanel 布局存档；这类页靠分区内容块错峰作局部动。要给带子地址的新页开平移，先把这类 id 改成随槽唯一。切页动画只有**一处路由监听**（`layout/page-track.tsx` 的 layout effect）：地址一变就查动效档、记账判方向，按钮与页面禁止自己触发切页（侧栏导航、标题栏前进后退、菜单项一律只是普通 navigate）。
   - 两类不得混用：局部动不许推整条轨道，整页动不许叠加整页淡入。
- 路由保活：非当前槽 `inert` + `aria-hidden`，平移收尾后 `visibility: hidden` 冻结（页面不卸载，各自保留组件状态与滚动位置）；每槽用 `UNSAFE_LocationContext` 覆盖成自己的地址（冻结页不跟随当前 URL），各带独立 ScrollArea 与 Suspense。**骨架屏阶段的槽不保活**：Suspense 内的就绪信号（`SlotReady`）在页面真正挂载后才把槽标记为 ready，收尾裁剪只留 ready 的邻位槽，还在加载的非当前槽直接丢掉、不占 3 槽名额（当前槽例外，留着等它加载完）。页面归属单一来源是 `routes/registry.ts`，槽按地址 `matchRoutes` 解析叶子组件，外壳不再有 Outlet。
- 浮层内发起的切页要等浮层消失再导航（sidebar-user 的 `goTo` 延后 `MENU_CLOSE_MS`）：菜单/抽屉是 body Portal，还开着时轨道平移会在浮层背后跑完，观感就是「切页没有动画」。动画本体仍只由轨道决定，浮层只管自己的关闭时序。
- 动画本体只能是 CSS：快照伪元素 `::view-transition-*` 用 WAAPI 碰不到（`pseudo` 只支持宿主 `::before/::after`），JS 侧只写 `--vt-*` 参数；主题切换那条链路沿用「桌面窗口与主题切换」的规则，不得换成 JS 驱动。规范里没有 `:types()` 这种功能伪类，别按记忆往快照选择器上加（写了会整条规则失效）。
- 反馈先于动画：可点元素的乐观反馈当帧生效，重活排到下一任务；跨页/异步结果的一次性提示一律用 `ui/toast` 的 `toast.add()`（出口 `<Toaster />` 在 main.tsx 挂一次），禁止各页自造提示条。动画只做修饰，绝不做功能前置——`prefers-reduced-motion` 下全部可静默关闭（index.scss 的全局压平 + `lib/motion.ts` 自查跳过），旧运行时缺能力（VT / scroll-driven / `allow-discrete`）自动降级为直接切换。
- anime.js 一律经 `lib/motion.ts`（时长/缓动档位与入场编排都在这，页面/组件不得写死数值，也不得直接 import `animejs`）；接入用官方集中形态——`useMotionScope(root, register)` 建作用域、`self.add(名字, 方法)` 注册、按需调用 `scope.methods.<名字>()`、卸载整体 `revert()`。只动 `transform`/`opacity`/CSS 变量。几何动画（`width`/`height` 等）只在这三条全不成立时放行，且限短时长：元素自身不带 `backdrop-filter`、不在磨砂层背后（不进对方 backdrop 采样范围）、改动不引发大面积重排——绝对定位小元素即此例外（实例：`components/option-switch.tsx` 游标拉伸，宽度 keyframes 300ms——前 18% 粘住、58% 到峰值、末段回目标宽，峰值＝目标项宽+位移一半，夹在生长侧可用空间与轨道内宽；按运动方向生长——右切左缘不动、左切用等量负 `margin-left` 让右缘不动（不改滑行用的 `transform`）；滑行缓动 `cubic-bezier(0.7,0,0.2,1)` 四个入口共用；逐帧改整块几何才会每帧重栅格化，流程节点拖动掉帧即此因）。
- 磨砂块不许逐帧位移：带 `backdrop-filter` 的元素每帧平移 = 每帧重新采样背后像素。`revealStagger` 已自动分档（块内检出磨砂层就只淡化、不平移，登录卡片进场即此路），新增入场/位移动画沿用该判定，不要把位移动画直接挂到 Card、菜单等磨砂层上；确实要拖动它们（如流程节点）就必须先退出全局磨砂。

侧边栏：
- 三态模式 `expanded/icon/hidden` 以 zustand（store/ui.ts）为唯一持久化源；`collapsibleFor/openFor/modeFromOpen` 三个纯函数是领域模式↔注册表二态的唯一翻译处（含 hidden 不被 provider 抹掉），组件里不得再各自写映射。Ctrl+B 与标题栏按钮共用 `cycleSidebarMode`。
- 侧栏**常驻挂载**保证三态切换均有出入动画：`collapsible` 按模式取 `icon`/`offcanvas`（hidden=offcanvas 左滑出屏），provider `open` 仅在 expanded 为真；hidden 态容器加 `inert` 防离屏聚焦。勿改回条件卸载（会丢过渡）。
- Ctrl+B 由 `shortcuts/sidebar-hotkey.ts` 普通监听接管三态；ui/sidebar.tsx 内置的两态热键已删，不要再加 `stopImmediatePropagation` 抢时序（移动端不拦截，走抽屉）。
- 宽度单通道：`lib/sidebar-channel.publishWidth` 只写 `<html>`，侧栏/拖拽手柄/画布内容面/悬浮侧栏全部继承它；可拖区间 `WIDTH_MIN`/`WIDTH_MAX` 也在该模块，拖拽钳制与 store 持久化收敛共用同一档。拖拽期间直写文档根，pointerup 才提交 store。禁止在 provider/锚点/组件上再 inline 重复变量。
- hidden 态另挂左缘悬浮侧栏（sidebar-peek.tsx，官方非模态 Sheet + 复用 sidebar-body.tsx，`tooltip={false}` 抑制全宽态的重复提示），几何、磨砂与 1px `--edge` 极浅描边在 index.scss 契约条目 5/6，组件侧不再写 border 类。
- ui/sidebar.tsx 的 CLI 手改例外共三处：删 cookie 写入、删内置 Ctrl+B、去掉 wrapper 的 inline `--sidebar-width(-icon)`；CLI 更新后会带回，需按 STRUCTURE.md 的 ui/ 例外行复原。
- ui/button.tsx 的 CLI 手改例外共两处：加 `chrome` 变体（chrome 态色三档）、`ghost` 改用同一套 `--chrome-hover/press` 标度（保留 CLI 的 `bg-muted` 会让页面按钮与 chrome 按钮悬停深浅不一致）；`shadcn add button` 前先看 `--diff`，按 STRUCTURE.md 的 ui/ 例外行复原。
- 行容器的 `[contain:paint]` 是 fixed 侧栏的包含块（侧栏始于标题栏之下、被整窗圆角裁剪），不可移除；勿换成 transform（DPI 缩放下文字发虚）。

内容区分栏：
- `layout/content-layout.tsx` 挂在 `page-track` 外层（由 app-shell 组合）：外层 `orientation="vertical"` 先切「上半部（主内容+右栏）/ 底栏（横跨整条内容区）」，上半部再嵌 `orientation="horizontal"` 切「主内容 / 右栏」——右下角归底栏、无三方拼缝；换页平移仍只发生在左上 page-track，右栏与底栏不随换页移动。
- 组件与 API 形态照 shadcn base `resizable`（`ui/resizable.tsx` 封装）：面板尺寸用百分比字符串 `defaultSize`、分割线用 `withHandle`；**不用库自带 autoSaveId**，尺寸与两条收起态合存 `STORAGE_KEYS.contentSplit` 单键（走 `lib/storage`；启动闸门放行后用 `readTextSync` 首帧同步取真值，不先按默认值闪一下）。
- 拖动松手（`onLayoutChanged` 的 `isUserInteraction`）才提交，拖动期零 React 状态更新。右栏最小宽 200、底栏最小高 160、主内容最小 560×360（px 常量）；`collapsedThreshold="100%"` 让拖动只停在最小尺寸、绝不吸附收起。
- 收起态单源在 `store/content-split`（运行态、不接 persist）：标题栏 `content-split-actions.tsx` 的两个按钮、`shortcuts/content-split-hotkey.ts` 与面板标题区的关闭按钮都只调它的 `toggle`；`content-layout` 订阅它驱动面板、并负责把「尺寸 + 收起态」写回 `STORAGE_KEYS.contentSplit` 一个键，别处不得再写。面板内只有「关闭」入口（只收不起，图标与标题栏该面板开关的「已展开」图标同一枚），展开只在标题栏/热键，绝不加边缘展开把手。
- 宽度不足 760 / 高度不足 520 自动收起对应面板（固定常量，不落盘，窗口恢复即还原用户设置）。自动收起期间标题栏按钮置灰（`aria-disabled`）但保留可点，点击用 toast 说明原因，不能静默无响应。
- 收起/展开过渡只在按钮与热键触发时播：`content-layout` 在根上临时挂 `data-animating="open|close"`，CSS 过渡面板外层内联 `flex-grow`（库同组两块份额和恒为 100，两侧自然同步缩放）与面板内容 opacity（目标由根上 `data-off-right`/`data-off-bottom` 与布局层同批写入，React 只管 inert/aria-hidden），时长取快档单源 `--push-duration-fast`（200ms）、缓动取 `--ease-push`，内容 0.7 档、错峰 0.3 档（open 几何先走、close 内容先淡出），不得另立常量；连续切换不重播——改写目标值由 CSS 从当前视觉位置折返，计时器只重置。拖动（按下即摘标记）、自动收起、`prefers-reduced-motion`、主题圆形揭示（经 `lib/theme-transition` 的 `onThemeTransitionStart`/`isThemeTransitioning`）一律即时到位，DEV 记 `anim-start`/`anim-retarget`/`anim-end`/`anim-skip`；落盘仍只写收起态布尔最终值，不写动画中间值。

目录规范：按职责独立成目录，互不越界。
- `components/ui/`：shadcn CLI 生成的组件（勿手改，走 CLI 更新；已知例外见 STRUCTURE.md 的 ui/ 行）。次选 `@ai-elements` 与 `@useanimations` 条目是 `registry:component` 类型，按 CLI 归位落在 `components/` 别名下（**不进 `ui/`**；useanimations 落 `components/animations/` + player `use-animation.tsx`），同样属 CLI 生成件、同样勿手改，更新走 CLI。
- `components/layout/`：应用外壳布局（app-shell/content-layout/content-split-actions/page-canvas/page-track/class-names/chrome-group/icon-action/title-bar/sidebar-body/sidebar-projects/sidebar-user/sidebar-cycle-trigger/sidebar-peek/sidebar-resizer/theme-menu/window-*（controls/drag-region/pin/bootstrap））。
- `components/*.tsx`：业务组件与通用外壳件（brand-logo、chat=AI 聊天组件（唯一入口 session 对象驱动，零路由零存储）、icons=图标统一入口（AppIcon 静态/动画合并 + AnimationIcon Lottie，登记表摇树、模块级单例）、page-card=单卡片演示页骨架、option-switch=分段/开关通用控件、theme-provider、stagger-reveal=错峰入场容器、storage-status-toast=落库失败全局轻提示）。
- `routes/`：路由表 `router.tsx` + 外壳子页表 `registry.ts`（页面归属、`handle.motion` 动效档、`handle.nav` 侧栏导航元数据、`handle.access` 所需权限的唯一声明处；`navItems` 由该表派生）+ 页面 `pages/`（未知路径由 `pages/empty-state` 的「页面不存在」空状态兜底，`registry.ts` 末尾 `path:"*"` 注册、不挂 `nav` 故不进侧栏；无权限由同文件「没有访问权限」空状态呈现；`restricted-demo` 是 `demo:restricted` 演示项，正式接入角色体系后删除；新增路由不得绕过该兜底）。
- `store/`：zustand 状态（`ui`/`auth`/`projects` 走 persist；`content-split` 是跨分支共享的收起态运行态单例、`chat-drafts` 是未落库草稿登记处（每范围至多一个、复用不重复建）、`chat-runs` 是生成态登记处（槽地址→对话/草稿 id，侧栏生成中指示派生），均不接 persist——content-split 持久化仍归 `content-layout` 写单键）。
- `hooks/`：通用 React hooks。
- `lib/`：`tauri/`（IPC 命令与事件常量表 + 窗口能力）、`backend.ts`（后端形态/地址/鉴权头单源）、`api.ts`·`chat.ts`（消费 backend）、`sidebar-channel.ts`（宽度通道）、`glass-channel.ts`（个性化旋钮通道：磨砂两项 + 背景渐变）、`radius-channel.ts`（四角圆角通道）、`motion.ts`（动效单源：时长/缓动/错峰档 + 入场编排，anime.js 唯一入口）、`route-history.ts`（历史位置：历史穿越方向与前进后退可用性的唯一来源）、`storage.ts`（Dexie/IndexedDB 持久化唯一门面：表/索引/迁移/异步读写/批量提交/重试/跨窗口同步/首帧主题 cookie）、`store-sync.ts`（跨窗口 store 同步唯一登记处：持久化键 → store 灌入，未登记键开发环境告警）、`theme-transition.ts`（主题切换事务：手动选择与系统变化共用圆形揭示，优先级 user > system、排队合并、reduced-motion/隐藏/无 VT 降级）、`access.ts`（权限判定单源：路由 `handle.access` → `useAccess`/`canAccessWith`；占位权限来源 `PLACEHOLDER_GRANTS` 按登录用户名，正式接入只替换 `permissionsOf`）。网络请求与令牌注入、localStorage 键名禁止在页面里各写一份。
- `shortcuts/`：`registry.ts` 是快捷键唯一来源（combo 结构 + 类别 + 生效端；`comboText/entryText` 派生展示、`comboMatches` 供匹配），`webview.ts` 按清单安装 block/hotkey，`sidebar-hotkey.ts` 只挂三态循环，`content-split-hotkey.ts` 只挂右栏/底栏收起切换。新增热键/拦截必须进清单，否则设置页漏项。主题切换无热键，仅菜单触发。
- `styles/`：额外全局样式（typeset.scss）。
架构边界（eslint 强制）：Tauri IPC 仅在 `lib/tauri/`；Eden 仅在 `lib/api.ts`；fetch 仅在 `lib/chat.ts`（AI SDK transport 注入鉴权头）；Dexie/IndexedDB、localStorage/sessionStorage 与 `document.cookie` 仅在 `lib/storage.ts`；路由权限判定仅在 `lib/access.ts`（声明在 registry 的 `handle.access`，菜单与页面准入都调用 `useAccess`，禁止页面内各写 if）；其余代码禁止裸 `fetch` 与直接存储。
