# 经验沉淀

> 只记踩过才知道的结论。自由增删，过期即删，单条一行。
> 新增门槛：**同类问题出现过三次以上**才入库；首次的偶发坑只写在当轮改动清单；AGENTS 已覆盖的纯规则不重复记。

## WebView2 / 窗口
- WebView2 多 HWND：app-region 转发走 Chromium 子窗口↔DWM，不经宿主 WndProc → web 自绘按钮申报 HTMAXBUTTON 无门，贴靠浮层等 WCO 转正
- 触摸/鼠标拖窗正解：`ICoreWebView2Settings9.SetIsNonClientRegionSupportEnabled(true)` + `app-region: drag`
- `window-drag-button` 是 WCO 专用，普通页面不认且会废掉该元素的 drag 转发（判别：tooltip 还弹=没转发）
- `startDragging` 只认鼠标、必须 mousedown 时机调用；挪到 pointerdown 连鼠标都会坏
- 查 Windows 版本用 `RtlGetVersion`（`Wdk` 是顶层命名空间，参数 Win32 `OSVERSIONINFOW`）；浮层最低 build 22621
- Tauri 事件回调不 await 异步 handler：内部自己 try/catch
- 无边框窗口顶部 1~2px 白线不是 DOM：`shadow:true` 会让 tao 在 WM_NCCALCSIZE 留一条非客户区（供 HTTOP 拖窗），由 DWM 绘制（判别：注释整个 html 仍有线）→ 已改 `shadow:false` 关掉 OS 边框/阴影，窗口描边由壳根末尾 `[data-app-edge]` 自绘 1px（仅桌面渲染）
- `shadow:false` 后缩放热区落进客户区：宽度就是 `SM_CXFRAME/SM_CYFRAME`，DPI 换算后恒约 4 CSS px（tao `hit_test` 只用 frame，不加 `SM_CXPADDEDBORDER`）；标题栏按钮排 `pl-2/pr-2`=8px 已避开，纵向滚动条贴右缘会落进热区（拖它可能变缩放，实机留意）
- 系统窗口材质已评估并撤销（别再走这条）：Tauri 2 核心 `windowEffects`/`set_effects` 档位分裂（公开 `DWMWA_SYSTEMBACKDROP_TYPE` 需 build≥22523、Win11 初版 Mica 走私有 1029、Win10 acrylic 走未公开 `SetWindowCompositionAttribute`、Linux 无分支＝no-op、`radius`/`state` 仅 macOS、`clear_effects` 漏清 Tabbed），更要命的是**材质自带 DWM 投影与 1px 框线且无公开 API 可关**（`DWMWA_BORDER_COLOR=NONE` 只压线不压影），失焦时系统还把材质压成灰平、用户关「透明效果」又变实心 → 结论：磨砂只做 CSS，平台一律一致
- CSS 侧磨砂的两个可调量走通道（`--glass-blur`/`--film-a`）：`color-mix(in oklab, var(--shell) calc(var(--film-a) * 1%), transparent)` 实测可用（var 代入先于解析，百分比允许 calc）；衬层恒实心，只有内容面吃这两个旋钮
- Win11 对顶层窗口恒按约 8px 裁切圆角、系统不给查询 API（CSS 设 0 也不是真直角）→ setup 里 `DWMWA_WINDOW_CORNER_PREFERENCE=DWMWCP_DONOTROUND` 关掉，四角曲线全归 CSS；原 `get/set_window_corners` 只是 Rust 端的存值+回声（无任何平台动作），随该结论一并删除，圆角真值改由 web 设置项持久化

## 主题 / View Transitions
- VT 期间文档被快照树整体替换：透明窗口必须给 `::view-transition` 铺底色，否则空帧透见桌面；该底色矩形还得带 `border-radius: var(--app-radius)`（与文档根同源圆角），否则明暗切换的 300ms 内四角被填成尖角
- `startViewTransition(cb)` 的 cb 不在点击同 tick 执行，React 状态又走批处理 → 点击当帧毫无反馈才是「顿一下」的根源；正解＝按钮反馈做本地乐观档（点击当帧提交）+ 事务排到下一个任务，class 仍在 cb 内同步落。反面教训：cb 里包 `flushSync`（只有 `react-dom` 导出，`react` 没有）不但不更快，还把整树同步渲染压到快照捕获之前，更卡；另 `ready`/`finished` 在无帧或被打断时必 reject，不接住就是控制台里的未处理拒绝
- 窗口最小化时 WebView2 停帧但 JS 照跑：rAF 永不回调 → 出场/就绪这类信号只能挂 useEffect，不能用帧或 `onload`；另 `ShowWindow(SW_MINIMIZE)` 属 show 类，会把 `visible:false` 的窗口显示成最小化（任务栏有按钮、不上屏）
- 动画用纯 CSS 方向规则（`.dark` 回调内翻转、先于新快照捕获）；`.ready`+WAAPI 会被跳过机制静默吞掉
- 半透明暗色令牌（`--border`=10% 白）禁止衬硬编码浅色底：暗色令牌多为半透白，衬浅色底会恒显白线（判别信号：切换主题后某条线不随主题变）

## 构建 / 工具链
- Tailwind v4 + SCSS：`@tailwindcss/vite` 只编译 .css 入口，.scss 入口时 @theme/utilities 原样漏出且无报错（判别：页面失样式、dev 样式表 theme/utilities 层为空、产物含 raw `@theme`）→ 改 `@tailwindcss/postcss` 挂 `css.postcss`；同理 .scss 内 @apply 不被编译，base 层写原生 CSS
- 类型门必须用 `bun node_modules/typescript/bin/tsc -b --force`：`tsc --noEmit` 会复用 `.tsbuildinfo` 整轮跳过（实测两次漏报：undefined 组件、未导入的函数，运行时才炸）；`npx tsc` 命中的是同名占位包（打印 "This is not the tsc command you are looking for" 且退出码 0），别用
- `cmd | tail` 吞退出码；编译验证重定向到日志再看 `$?`
- gen-api 重写的空窗期会 TS2307 → 手动 `bun run generate_script`；别跑 `generate`（触发 drizzle 迁移）
- 控制器子目录+`.post("/")` 在 strictPath 下得到尾斜杠路径 → 平铺文件+显式相对路径
- 任意属性类可能被 render 合成链吞：关键样式用内联 style；JSX 注释不能进 `render={...}`

## React / UI
- zustand persist 的 `migrate` 只在 version 变化时才跑，同版本的手改脏值原样进 state（NaN 会写成 `--app-radius: NaNpx`，整条声明被 CSS 丢弃）→ 每次加载都收敛要挂 `merge`；注意 `merge` 的返回值是**整体替换** state（内部 `set(x, true)`），必须 `{ ...current, ...收敛 }` 才不丢 action
- 高频拖动：拖动中直写 DOM CSS 变量，pointerup 才提交 store（persist 一帧一次）
- 拖拽宽度基准只能用「按下时宽度 + 指针行程」：拿手柄 `getBoundingClientRect().left` 当基准等于把旧宽度减掉自己（`left≈边位置≈宽度`，fixed 相对 contain:paint 行也不含页面滚动偏移）→ 一起手就塌到下限，看起来「每次拖动都弹回」；另外 `set/releasePointerCapture` 在无活动指针或元素已被重建时必抛，release 抛在提交之前就吃掉本次拖宽，捕获一律 best-effort
- 设备/窗口状态用模块级单例快照 + `useSyncExternalStore`，勿逐组件订阅
- shadcn CLI ResizableHandle 把 children 换成 withHandle 分支，业务侧传的线/把手永不渲染（DOM kids 为空）；把手视觉只能挂 `[data-slot=resizable-handle]::before`（react-resizable-panels v4 无 data-state 属性可用）
- `shadcn add` 带 registryDependencies 时会要求覆盖已有定制文件（如 button.tsx 的自定义变体）：先 `--dry-run` 看覆盖清单，交互提示回答 n 可跳过覆盖并继续创建其余文件
- react-resizable-panels v4 的 `useDefaultLayout({id})` 落盘键是 `react-resizable-panels:<id>`（前缀库自加），存的布局按「panel id 集合」索引：Panel 缺 id 就落到自动 id，恢复会静默失配退回默认尺寸 → 每个 Panel 都要给稳定 id
- Base UI Portal 的遮罩与面板之间夹辅助 span，`:has(+ …)` 相邻兄弟不成立 → 用 `:has(~ …)` 通用兄弟
- 无渲染帧的环境（内置无头浏览器、未合成/隐藏的 webview）里 rAF 与动画全冻结：VT/动画不可目测、Base UI 弹层 `data-starting-style` 永不摘除（停在 opacity:0+位移），别据此判定样式失效 → 按最终状态用 computed left/width 断言，动画留给真窗口
- 同一坑的更阴险变体：隐藏表面里 `getComputedStyle` 会回吐**上一个已绘制帧**的值——切换主题或改内联样式后读数纹丝不动（连 `style.borderColor=…!important` 都像被无视），据此会误判成「有条 !important 压住了我」。判别信号：同一元素上 `--token` 读起来是新的、依赖它的属性却是旧的。正解=要验主题相关值就先把该主题写进存储再 reload，让那一帧真正是新主题；或直接查 dist CSS
- 生成式路由树只导出其中一个顶层前缀时，其余前缀（如 /offline）代码存在但不可达：生成器必须组合导出全部顶层 plug，形态差异改由运行期门控（404）表达
- cargo 的 cfg(debug_assertions) 不能用于 [target.*] 选依赖（cargo 直接告警失效）：按构建模式开关能力一律走 [features] + CLI 的 --features 透传
- 一次性随机令牌 ≠ 服务可用：令牌必须由"进程已起来且未退出"的就绪状态门控，否则前端拿到的判据是假的（所有请求 401/拒连且无提示）
- CSS 变量的继承域=DOM 子树：Portal 到 body（Sheet/Dialog）或挂在壳根的画布锚点取不到 provider 子树里定义的变量（如 `--sidebar-width`），失效后退化成 auto，绝对定位空 div 塌成 0 宽细条（表面只像"颜色不对"）→ 通道一律发布到文档根，别在每处 inline 补一份
- 整窗圆角走静态规则 `html, body{border-radius:var(--app-radius);overflow:hidden}`（用户实测生效档），通道只出值、不挂属性标记。两层同时画圆角的前提是**盒完全重合**：body 由 preflight 去 margin，与 html 同原点同尺寸，弧逐像素对齐。原点不同的两层（文档根 + 壳根）才是灾难——两层同半径矩形相交会把不到 1px 的框偏差放大成逐角递减的弧（左上原点重合最准，右上→右下→左下依次变小，半径越小越明显，就是用户报的「四个角配置一样但顺时针越来越小」），所以壳根/登录页根/页面组件一律禁止再画圆角，组件内也禁止 inline `borderRadius`。另注：只写 `border-radius` 不写裁切看不见——主干链零背景，圆角处该露桌面的是页面画布矩形，`border-radius` 只削元素自己的背景/盒线，不裁后代。描边层与 `::view-transition` 底色层读同一变量只用于画线/画底，不构成第二处裁切（`inherit` 在这里不可用，因为父层已无圆角）
- 主干恒透明时圆外像素不画布，透明窗口处即露出桌面，所以裁切生效与否只能靠实窗看；无帧环境里 `elementFromPoint` 命中测试也判不出来（画布层 `pointer-events:none`，命中永远落到 `#root`）
