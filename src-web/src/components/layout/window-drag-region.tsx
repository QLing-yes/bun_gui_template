// 标题栏拖动区：-webkit-app-region drag 交给系统（触摸/鼠标拖窗、双击最大化原生支持）；
// 下方 pointer 处理器为旧 WebView2 运行时的鼠标降级路径（区域生效时收不到事件，自然旁路）

import { startDraggingWindow, toggleMaximizeWindow } from "@/lib/tauri"

export function WindowDragRegion() {
  return (
    <div
      className="h-full flex-1 touch-none [-webkit-app-region:drag]"
      onMouseDown={(e) => {
        if (e.button === 0) startDraggingWindow()
      }}
      onPointerDown={(e) => {
        if (e.isPrimary && e.pointerType !== "mouse" && e.button === 0)
          startDraggingWindow()
      }}
      onDoubleClick={toggleMaximizeWindow}
    />
  )
}
