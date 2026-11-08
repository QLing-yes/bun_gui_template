// 窗口 chrome 的动作簇：标题栏与登录页顶栏左右两端的 no-drag 容器
// 只统一这一层；整条 chrome 条不抽象——壳内是流内 header、登录页是 fixed、浏览器档是两个悬浮角，定位差异无法收敛

import type { ReactNode } from "react"
import { cn } from "cn"

import { CHROME_GROUP_CLASS } from "@/components/layout/class-names"

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
    <div className={cn(CHROME_GROUP_CLASS, side === "left" ? "pl-2" : "pr-2")}>
      {children}
    </div>
  )
}
