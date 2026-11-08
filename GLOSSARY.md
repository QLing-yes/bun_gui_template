# 词汇表（领域与架构）

> 本文件给"好的接缝"命名：跨模块沟通、架构复核、命名新模块时以本文为准。
> 规则：一个词一行，写清它指什么、边界在哪、真值来源在哪。

## 分发与后端

| 词 | 含义 | 真值来源 |
|---|---|---|
| 分发形态 | 离线桌面 / 服务桌面 / web 部署三种发布方式 | 根 AGENTS.md；代码侧判据只有 `VITE_API_URL` 与 sidecar 令牌 |
| 公共路由 `/api/**` | 三种形态都有的接口 | src-bun `app/controller/api/` |
| 本机路由 `/offline/**` | 仅本地 sidecar 形态可用的接口；服务器形态按令牌 404 | src-bun `app/controller/offline/` + `app/plugins/controller.plug.ts` 门控 |
| 令牌（SidecarToken） | 一次性随机串，证明"这个请求来自本机 webview" | src-tauri 生成并注入 `TAURI_SIDECAR` |
| 就绪（SidecarReady） | sidecar 进程已起来且未退出 | src-tauri `state.rs`；「令牌非空」等价于「就绪」 |
| 后端目标 | 某次请求该打到哪个地址、带哪些头 | src-web `lib/backend.ts`（唯一出口） |

## 界面结构

| 词 | 含义 | 真值来源 |
|---|---|---|
| 主干链 | 窗口→html/body/#root→壳根→provider→行→标题栏→侧栏→inset→页面根 | 一律零背景（铁律，见 src-web/AGENTS.md） |
| 衬层 | 页面画布底层：壳色 + 噪点 + 两处晕染，铺满全窗 | src-web `components/layout/page-canvas.tsx` |
| 内容面 | 页面画布上层：半透壳色 + 12px 磨砂，让位标题栏带与侧栏列 | 同上；着色在 index.scss 契约条目 3 |
| 锚点 | 壳根里承接画布 Portal 的全窗节点（绕开 `contain:paint`） | `page-canvas.CanvasAnchor`（模块自持，无 context） |
| 标题栏带 | 自绘标题栏占住的那 2.5rem 高度 | `@theme --spacing-titlebar` |
| 侧栏三态 | expanded / icon / hidden | `store/ui.ts`；到注册表二态的翻译也在这里 |
| 宽度通道 | 发布到文档根的 `--sidebar-width(-icon)`，侧栏/画布/悬浮侧栏共同继承 | `lib/sidebar-channel.ts` |
| 圆角通道 | 通道只出**值**：文档根 `--app-radius` 的四角半径串；形状与裁切是静态规则 `html, body{border-radius:var(--app-radius);overflow:hidden}`（两层盒重合才允许，无属性标记），只有最大化为 0；桌面与 web 同一套值（web 圆外露 UA 画布色）。描边层与 VT 底色层读同一变量只用于画线/画底，不算第二处裁切 | 值在 `store/ui.ts` 的 `corners`；写入在 `lib/radius-channel.ts`，合成器 `layout/window-radius.tsx`；规则在 index.scss `html, body` |
| 窗口描边 | OS 边框/阴影关闭后由 web 自绘的 1px 窗缘浅线（仅桌面渲染） | index.scss `[data-app-edge]` + `--edge` |
| 区域滚动 | 滚动只发生在区域级容器（壳内 ScrollArea / 全屏页自管滚动盒）；文档与窗口永不滚动 | 裁切在 index.scss `html, body{overflow:hidden}`；壳内是路由轨道每槽各自的 ScrollArea（`layout/page-track.tsx`），登录页 `login.tsx` 根 `h-svh overflow-y-auto` |
| 个性化旋钮 | 内容面自糊半径、壳色不透明度、衬层背景渐变开关三个通道量（`--glass-blur`/`--film-a`/`--wash-a`）；系统材质已撤销不用 | `store/ui.ts` ↔ `lib/glass-channel.ts`（前三个） |
| 明暗三选项 | 浅色/深色/跟随系统三档（存储值 `light`/`dark`/`system`）；标题栏/登录页顶栏/设置页/侧栏用户菜单四处统一经 `layout/theme-menu.tsx` 接线（标题栏与侧栏是窄档、设置页带文案），读同一张选项表与同一个切换事务 | 表与事务 src-web `hooks/use-theme-switch.ts`，接线 src-web `components/layout/theme-menu.tsx`，控件 src-web `components/option-switch.tsx`，状态与解析 `components/theme-provider.tsx`，存储键 `lib/storage.ts` 的 `theme` |
| 选项游标 | 分段选项里那枚滑行到选中项的**实心浮起滑块**：轨道吃 `--chrome-hover`(10%)，游标吃 `--background` + `--edge` 1px 描边环 + 外投影，文字靠 `z-10` 压在其上；选中不由底色刷出，由游标位置表示。圆角固定：轨道 32px（模块常量，不可调）、游标恒为半圆端（两者不严格同心）；内衬 sm 上下 2px／default 4px、左右恒 4px，整条高度＝选项高+上下内衬×2；宽度恒自适应内容，换项时另做 300ms 拉长（峰值＝目标项宽+位移一半，夹在生长侧可用空间与轨道内宽；按运动方向生长——右切左缘不动、左切用等量负 `margin-left` 让右缘不动；前 18% 粘住、58% 到峰值）。主题切换要**等游标滑到位**再启动（时长常量 `SLIDE_MS` 由控件导出） | 全在 `components/option-switch.tsx`：几何量算直写 style、配色与时长/曲线常量、导出 `SLIDE_MS`；index.scss 只承载拉伸用的 `option-switch-stretch` keyframes，其余规则与令牌不落该处 |
| 动效取向 | 按场景分工且**动画只动局部**：主题切换→VT 圆形揭示（唯一全屏动画，本体仍是 CSS）、路由切换→内容区轨道平移（DOM 轨道，chrome 不参与）、非当前槽冻结保活、元素编排/错峰→anime.js、悬停进出场→CSS 动画、滚动进度→scroll-driven CSS；切页不用淡入淡出 | 规则在 src-web/AGENTS.md「动效与体验优化」；错峰与抖动入口 `lib/motion.ts`（`revealStagger`/`shake`），主题参数 `lib/theme-transition.ts`，轨道几何与 `--push-duration`/`--ease-push` 在 index.scss + `layout/page-track.tsx`，降级在 prefers-reduced-motion 块 |
| 动效档 | 路由对象 `handle.motion` 携带的动画声明（enter/query/reveal 三档），轨道与入场容器只读它；同一 handle 上的 `nav`（label/icon/order）是侧栏导航元数据，`navItems` 由路由表派生 | src-web `routes/registry.ts` |
| 历史位置 | 上一条历史条目号 + 前进上界：历史穿越（后退/前进）的方向与前进后退可用性的唯一来源（全应用只有它读 `history.state.idx`）；菜单点击是新条目，方向改由轨道按目标槽左右侧定 | src-web `lib/route-history.ts`（历史）+ `layout/page-track.tsx`（槽位） |
| 页面槽 / 保活 | 路由轨道里的一个已挂载页面：槽身份按该页 query 档取 pathname 或完整地址（`seq` 定左右位置，越大越靠左），当前槽居中，其余 `inert` + 收尾后 `visibility:hidden` 冻结——不卸载、保留组件状态与滚动位置，且不跟随当前 URL（每槽覆盖自己的 Location 上下文）；前翻/后翻按浏览器历史条目序号判，pathname 变才算整页动 | 状态与几何在 `layout/page-track.tsx`；冻结与平移规则在 index.scss 的 page-track 一节 |
| 出场（reveal） | 启动不占屏（Windows 最小化，其余保持隐藏），web 首屏提交后还原+显示+聚焦 | `commands::reveal_window` ↔ `components/layout/window-reveal.tsx`；动作在 lib.rs `present_window` |
| 淡出线 | 1px、两端 4% 全透明的分割线（含两条可拖线），恒显不变色 | `--line-h` / `--line-v` |
| 覆写契约 | 本仓压过 shadcn/Base UI 内部实现的 13 条层外规则 | index.scss「注册表覆写契约」一节 |
| 快捷键清单 | 键位、展示串、生效端、行为的唯一来源 | `shortcuts/registry.ts` |
| 持久化登记 | 全部 localStorage 落点的唯一清单（store 键、明暗偏好、分栏布局 id、检视器位置）；键值发布后不可改。读写走同一门面：按键防抖落盘、`flushStorage`/`writeTextNow` 立即写、页面隐藏/卸载/关窗前强制 flush，zustand persist 经 `storageAdapter` 接入；`dev/layer-inspector.ts` 为唯一豁免（零依赖单文件自持） | `lib/storage.ts` |
