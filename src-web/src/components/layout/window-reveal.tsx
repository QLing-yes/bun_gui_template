// 窗口出场时机：应用启动即最小化，等 React 首屏提交后再通知 Rust 还原显示并聚焦

import { useEffect } from "react"

import { revealWindow } from "@/lib/tauri"

export function WindowReveal() {
  // 只挂 useEffect，禁止改用 rAF：窗口最小化时 WebView2 停帧，rAF 永远不回调
  useEffect(() => {
    revealWindow().catch((e) => console.error("[app] window reveal failed:", e))
  }, [])

  return null
}
