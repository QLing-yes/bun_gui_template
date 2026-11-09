// 窗口 chrome 动作簇：ChromeGroup=左右两端的 no-drag 容器；ChromeActions=右端主题/置顶/窗口三键（标题栏与登录页共用）
// 只统一这一层；整条 chrome 条不抽象——壳内是流内 header、登录页是 fixed、浏览器档是两个悬浮角，定位差异无法收敛

import type { ReactNode } from "react"
import { cn } from "cn"

import { ThemeMenu } from "@/components/layout/theme-menu"
import { WindowControls } from "@/components/layout/window-controls"
import { WindowPin } from "@/components/layout/window-pin"

/** 动作簇参数 */
type ChromeGroupProps = {
  /** 贴哪一侧：左端留 pl-2、右端留 pr-2 */
  side: "left" | "right"
  /** 簇内按钮 */
  children: ReactNode
}

export function ChromeGroup({ side, children }: ChromeGroupProps) {
  if (import.meta.env.DEV) {
    console.debug("[chrome] group", { side })
  }

  return (
    <div
      className={cn(
        // no-drag 让内部按钮可点，不参与窗口拖动
        "flex items-center gap-0.5 [-webkit-app-region:no-drag]",
        side === "left" ? "pl-2" : "pr-2"
      )}
    >
      {children}
    </div>
  )
}

/** 右端动作簇：主题菜单 + 可选的内容区开关 + 窗口置顶 + 窗口三键（桌面端三键由组件自身门控）
 * @param children 插在主题菜单之后、置顶之前的动作（登录页不传，那里没有内容区分栏） */
export function ChromeActions({ children }: { children?: ReactNode }) {
  return (
    <ChromeGroup side="right">
      <ThemeMenu />
      {children}
      <WindowPin />
      <WindowControls />
    </ChromeGroup>
  )
}
