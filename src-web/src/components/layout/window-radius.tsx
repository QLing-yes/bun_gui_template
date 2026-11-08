// 圆角合成：持久化的四角半径 + 窗口最大化状态 → 圆角通道（非桌面档与最大化输出 0）。渲染为空。
// 与 RouterProvider 同级挂在应用根（见 main.tsx），主壳与登录页吃同一组值，勿在页面里各写一份。

import { useLayoutEffect } from "react"

import { publishRadius } from "@/lib/radius-channel"
import { useWindowState } from "@/lib/tauri"
import { useUiStore } from "@/store/ui"

/** 圆角通道发布器 */
export function WindowRadius() {
  const corners = useUiStore((s) => s.corners)
  const { isMaximized } = useWindowState()

  // useLayoutEffect 抢在绘制前写通道，避免首帧按 :root 兜底值闪一下
  useLayoutEffect(
    () => publishRadius(corners, isMaximized),
    [corners, isMaximized]
  )

  return null
}
