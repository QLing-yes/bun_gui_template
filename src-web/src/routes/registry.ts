// 外壳内页面路由表：createHashRouter 的 children 与路由轨道共用同一数组（页面归属单一来源）
// 每页在路由对象的 handle.motion 上携带动效元数据：整页怎么动、同页换地址怎么动、页内内容块动不动，
// 全部由轨道读这张表决定——按钮与页面都不用自己触发切页动画
// 每页在 handle.nav 上同时携带侧栏导航元数据（名称/图标/顺序）：侧栏由本表派生，不再另存一份页面清单

import { BotIcon, FlaskConicalIcon, HomeIcon, KeyRoundIcon, WorkflowIcon } from "lucide-react"
import { lazy } from "react"
import type { ComponentType } from "react"
import { matchRoutes } from "react-router"
import type { RouteObject } from "react-router"

import type { RevealPolicy } from "@/components/stagger-reveal"
import type { RouteAccess } from "@/lib/access"
import { isTauri } from "@/lib/tauri"
import { HomePage } from "./pages/home"
import { NotFoundPage } from "./pages/empty-state"
import { RestrictedDemoPage } from "./pages/restricted-demo"

/** AI 对话页重依赖（ai/react-markdown）单独分包，不进首屏主 bundle */
const ChatPage = lazy(() =>
  import("./pages/chat").then((m) => ({ default: m.ChatPage }))
)
/** 流程测试页重依赖（@xyflow/react）单独分包 */
const FlowPage = lazy(() =>
  import("./pages/flow").then((m) => ({ default: m.FlowPage }))
)
/** 设置页与鉴权测试页只在进入时加载（首屏主包不再背 Tabs/滑杆/诊断代码） */
const SettingsPage = lazy(() =>
  import("./pages/settings").then((m) => ({ default: m.SettingsPage }))
)
const TestTokenPage = lazy(() =>
  import("./pages/test-token").then((m) => ({ default: m.TestTokenPage }))
)

/**
 * 路由动效元数据
 * @property enter 进入该页的整页动：pan＝轨道平移一格（默认），none＝直接落位（只作明确例外）
 * @property query 同页子地址（分区、参数）：slot＝每个完整地址各自成槽走整页平移（默认），local＝留在原槽只做页内局部动
 * @property reveal 该页内容块进场：stagger＝错峰，none＝不动
 */
export type RouteMotion = {
  enter: "pan" | "none"
  query: "local" | "slot"
  reveal: RevealPolicy
}

/**
 * 侧栏导航元数据（页面归属仍以本路由表为准）
 * @property label 导航项显示名
 * @property icon 导航项图标
 * @property order 显示顺序（小的在前）
 */
export type RouteNav = {
  label: string
  icon: typeof HomeIcon
  order: number
}

/** 路由 handle 载荷：动效档 + 可选导航元数据（不挂 nav 的页不出现在侧栏） + 可选权限声明 */
type RouteHandle = { motion: RouteMotion; nav?: RouteNav; access?: RouteAccess }

/**
 * 声明路由 handle（typed 包装，避开 handle 的 any）
 * @param m 动效档
 * @param nav 导航元数据（侧栏不展示的页省略）
 * @param access 所需权限（公开页省略；菜单可用性与页面准入都由它派生）
 * @returns 挂到 route.handle 的值
 */
function handleOf(
  m: RouteMotion,
  nav?: RouteNav,
  access?: RouteAccess
): RouteHandle {
  return { motion: m, nav, access }
}

/** 常规内容页档：hash 地址一变就整页平移，页内内容块照常错峰 */
const PAGE: RouteMotion = { enter: "pan", query: "slot", reveal: "stagger" }

/**
 * 页内分区档：同路径的子地址不另起槽，切分区只做页内内容块错峰
 * 给「两份同页实例并挂会出问题」的页用——设置页的 `settings-nav`、`settings-content`、
 * `glass-blur` 等 id 写死，ResizablePanel 也按同一 id 存布局，并挂会撞
 */
const PAGE_IN_PAGE: RouteMotion = {
  enter: "pan",
  query: "local",
  reveal: "stagger",
}

/** 匹配不到路由时的兜底：与常规页同档 */
const FALLBACK: RouteMotion = { enter: "pan", query: "slot", reveal: "stagger" }

/** 外壳子路由（index 即首页）；桌面专属页在数组层门控，导航派生自动跟随 */
export const shellRoutes: RouteObject[] = [
  {
    index: true,
    Component: HomePage,
    handle: handleOf(PAGE, { label: "首页", icon: HomeIcon, order: 0 }),
  },
  // AI 对话示例页（Vercel AI SDK + AI Elements）
  {
    path: "chat",
    Component: ChatPage,
    handle: handleOf(PAGE, { label: "AI 对话", icon: BotIcon, order: 1 }),
  },
  // 流程测试页（React Flow 示例）
  {
    path: "flow",
    Component: FlowPage,
    handle: handleOf(PAGE, { label: "流程测试", icon: WorkflowIcon, order: 2 }),
  },
  // 设置页（分区菜单：快捷键、个性化等）——分区是页内地址，走局部动；入口在用户菜单，不进侧栏导航
  { path: "settings", Component: SettingsPage, handle: handleOf(PAGE_IN_PAGE) },
  // 鉴权测试页依赖桌面端 sidecar，仅桌面注册
  ...(isTauri
    ? [
        {
          path: "test",
          Component: TestTokenPage,
          handle: handleOf(PAGE, {
            label: "鉴权测试",
            icon: KeyRoundIcon,
            order: 3,
          }),
        },
      ]
    : []),
  // 演示：受限导航项——声明当前账号不具备的权限，用来看「可用/受限」并列而不用改代码
  // 正式接入角色/权限体系后删除本条路由与菜单项（权限来源见 lib/access.ts 注释）
  {
    path: "restricted",
    Component: RestrictedDemoPage,
    handle: handleOf(
      PAGE,
      { label: "受限示例", icon: FlaskConicalIcon, order: 4 },
      { permission: "demo:restricted", label: "受限示例权限（demo:restricted）", demo: true }
    ),
  },
  // 未知路径兜底（hash 路由）：任何未匹配的子地址落到空状态页，不要求额外权限
  { path: "*", Component: NotFoundPage, handle: handleOf(FALLBACK) },
]

/** 侧栏导航项（由路由表派生） @property to 路由路径 @property label 显示文本 @property icon 图标组件 @property access 所需权限声明（无则公开） */
export type NavItem = {
  to: string
  label: string
  icon: RouteNav["icon"]
  access?: RouteAccess
}

/** 侧栏导航清单：path/label/icon/order/权限与桌面门控全在路由表，侧栏只消费结果 */
export const navItems: NavItem[] = shellRoutes
  .flatMap((route) => {
    const handle = route.handle as RouteHandle | undefined
    const nav = handle?.nav
    if (!nav) return []
    const to = route.index ? "/" : `/${route.path ?? ""}`
    return [{ to, ...nav, access: handle?.access }]
  })
  .sort((a, b) => a.order - b.order)
  .map(({ to, label, icon, access }) => ({ to, label, icon, access }))

if (import.meta.env.DEV) {
  console.debug("[nav] derived", navItems.map((item) => item.to))
}

/**
 * 按地址解析外壳子路由：页面组件 + 该页声明的动效档与权限（轨道一次匹配取全）
 * @param path 完整地址 @returns Component 页面组件（匹配不到或声明为空则不渲染）、motion 动效档、access 权限声明
 */
export function resolveRoute(path: string): {
  Component?: ComponentType | null
  motion: RouteMotion
  access?: RouteAccess
} {
  const leaf = matchRoutes(shellRoutes, path)?.at(-1)
  const handle = leaf?.route.handle as
    | { motion?: RouteMotion; access?: RouteAccess }
    | undefined
  return {
    Component: leaf?.route.Component,
    motion: handle?.motion ?? FALLBACK,
    access: handle?.access,
  }
}
