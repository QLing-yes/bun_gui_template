// 页面背景画布：背景是页面级资产，经 Portal 铺入壳根锚点（全窗，含透明标题栏/侧栏之下）
// 本模块同时拥有锚点（CanvasAnchor + 订阅槽位）、当前页归属与内容面偏移算法：主干零背景铁律的执行者
// 两层：①壳色+噪点+晕染衬底层 ②半透内容面（让位标题栏带与侧栏区，左上内圆角）

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
} from "react"
import { createPortal } from "react-dom"
import type { ReactNode } from "react"

import { ICON_VAR, WIDTH_VAR } from "@/lib/sidebar-channel"
import { useIsMobile } from "@/hooks/use-mobile"
import { useUiStore, type SidebarMode } from "@/store/ui"

/** 当前页标记（默认是）：路由轨道逐槽声明，只有当前页铺画布 */
const ActiveCanvas = createContext(true)

/** 声明这棵子树是不是当前页 @param active 是否当前页 @param children 页面内容 */
export function CanvasOwner({
  active,
  children,
}: {
  active: boolean
  children: ReactNode
}) {
  return (
    <ActiveCanvas.Provider value={active}>{children}</ActiveCanvas.Provider>
  )
}

/** 锚点元素 id（壳根唯一挂载点） */
const ANCHOR_ID = "app-canvas-anchor"

/** 锚点槽位与订阅集（模块私有，跨组件树传递用不到 context） */
let anchorEl: HTMLElement | null = null
const anchorListeners = new Set<() => void>()

/** 写入/清空锚点槽位并通知订阅者 @param el 锚点元素或 null */
function setAnchor(el: HTMLElement | null): void {
  if (anchorEl === el) return
  anchorEl = el
  for (const notify of anchorListeners) notify()
}

/** 订阅锚点变化 @param notify 变化回调 @returns 退订函数 */
function subscribeAnchor(notify: () => void): () => void {
  anchorListeners.add(notify)
  return () => {
    anchorListeners.delete(notify)
  }
}

/** 读当前锚点（SSR/未挂载为 null） */
function getAnchor(): HTMLElement | null {
  return anchorEl
}

/** 内容面左边距表达式：桌面档按侧栏三态让位（取通道变量，拖动同帧跟随），移动档/隐藏态铺满
 * @param mode 侧栏模式 @param desktop 是否桌面档 @returns CSS 长度表达式 */
export function surfaceLeft(mode: SidebarMode, desktop: boolean): string {
  if (!desktop) return "0px"
  if (mode === "expanded") return `var(${WIDTH_VAR})`
  return mode === "icon" ? `var(${ICON_VAR})` : "0px"
}

/** 画布锚点：由 AppShell 挂在壳根（absolute inset-0 -z-10 全窗），页面画布 Portal 于此 */
export function CanvasAnchor() {
  const attach = useCallback((el: HTMLElement | null) => setAnchor(el), [])
  return <div id={ANCHOR_ID} ref={attach} className="absolute inset-0 -z-10" />
}

/** 页面画布容器 @param children 页面前景内容 */
export function PageCanvas({ children }: { children: ReactNode }) {
  const anchor = useSyncExternalStore(subscribeAnchor, getAnchor, () => null)
  const sidebarMode = useUiStore((s) => s.sidebarMode)
  // 保活的多页只铺一份：内容面是半透的，叠两层壳色就比一层浓
  const active = useContext(ActiveCanvas)
  const left = surfaceLeft(sidebarMode, !useIsMobile())

  const canvas = active ? (
    <div data-slot="page-canvas-shell" className="absolute inset-0 bg-shell">
      {/* 内容面：着色/磨砂/左上内圆角全在 index.scss 契约条目 3；left 由本模块算，top 让位标题栏带 */}
      <div
        data-slot="page-canvas-surface"
        style={{ left }}
        className="absolute inset-x-0 top-titlebar bottom-0"
      />
    </div>
  ) : null

  return (
    <>
      {anchor && canvas ? createPortal(canvas, anchor) : null}
      {children}
    </>
  )
}
