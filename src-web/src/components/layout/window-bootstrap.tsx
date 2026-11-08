// 窗口首屏引导：圆角通道发布 + 出场信号，全应用挂一次（登录页与主壳共用同一组值/时机）
// 圆角用 useLayoutEffect 抢在绘制前写通道；出场只挂 useEffect，禁止改用 rAF——窗口启动即最小化，WebView2 停帧时 rAF 永不回调

import { useEffect, useLayoutEffect } from "react"

import { publishRadius } from "@/lib/radius-channel"
import { revealWindow, useWindowState } from "@/lib/tauri"
import { useUiStore } from "@/store/ui"

/** 首屏窗口引导：发布四角圆角并通知 Rust 还原显示、聚焦 */
export function WindowBootstrap() {
  const corners = useUiStore((s) => s.corners)
  const { isMaximized } = useWindowState()

  // 首帧绘制前落值，避免按 :root 兜底值闪一下
  useLayoutEffect(() => {
    publishRadius(corners, isMaximized)
    if (import.meta.env.DEV) {
      console.debug("[app] radius published", { corners, isMaximized })
    }
  }, [corners, isMaximized])

  // 首屏提交后才让窗口出场（还原+显示+聚焦全在 Rust 一侧做完）
  useEffect(() => {
    revealWindow().catch((e) => console.error("[app] window reveal failed:", e))
  }, [])

  return null
}
