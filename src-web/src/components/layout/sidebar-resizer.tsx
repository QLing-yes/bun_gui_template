// 侧栏宽度拖拽手柄：拖动中直写文档根变量（零 React 渲染、零持久化序列化），松手才提交 store
// 指针捕获、全局光标/选中归还、拖拽期禁过渡属性都在本文件；宽度算法见 lib/sidebar-channel

import { useCallback, useEffect, useRef } from "react"
import type React from "react"

import {
  WIDTH_MAX,
  WIDTH_MIN,
  nextWidth,
  publishWidth,
  readWidth,
} from "@/lib/sidebar-channel"
import { useUiStore } from "@/store/ui"

/** 手柄线（0.5px、竖向两端 4% 全透明），颜色走全局 --line-v 令牌 */
const LINE_CLASS =
  "absolute inset-y-0 left-1/2 w-[0.5px] -translate-x-1/2 bg-[image:var(--line-v)]"

export function SidebarResizer() {
  const setSidebarWidth = useUiStore((s) => s.setSidebarWidth)
  /** 拖动中标志（ref 版，事件内零渲染） */
  const draggingRef = useRef(false)
  /** 按下时的指针 x（位移基准：只用指针自身的行程，与手柄/容器偏移无关） */
  const startX = useRef(0)
  /** 按下时的生效宽度（增量起点） */
  const startWidth = useRef(0)
  /** 实时宽度（px），松手提交 */
  const width = useRef(0)

  /** 归还全局光标/选中/禁过渡状态 */
  const resetGlobal = useCallback(() => {
    delete document.documentElement.dataset.resizingSidebar
    document.body.style.cursor = ""
    document.body.style.userSelect = ""
  }, [])

  // 拖动中途卸载（如快捷键折叠）兜底归还全局状态
  useEffect(
    () => () => {
      if (draggingRef.current) resetGlobal()
    },
    [resetGlobal]
  )

  /** 按下：记录指针基准与起始宽度，接管指针并挂全局禁过渡标记 */
  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    startX.current = e.clientX
    startWidth.current = readWidth(WIDTH_MIN)
    width.current = startWidth.current
    draggingRef.current = true
    try {
      // 捕获是增强不是前提：手柄若在拖动中被重建（如 Ctrl+B 换态），这里会抛，拖拽照常
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* 忽略：无活动指针对象 */
    }
    document.documentElement.dataset.resizingSidebar = ""
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
  }

  /** 移动：钳制后直写文档根，侧栏/手柄/画布/悬浮侧栏同帧跟随 */
  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!draggingRef.current) return
    width.current = nextWidth(
      startWidth.current + (e.clientX - startX.current),
      WIDTH_MIN,
      WIDTH_MAX
    )
    publishWidth(width.current)
  }

  /** 松手：归还全局状态并提交 store（persist 一帧一次） */
  const onPointerUp = (e: React.PointerEvent<HTMLElement>) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    try {
      // 同上：手柄已卸载时 release 必抛，但宽度提交不能被它吃掉
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* 忽略：捕获已随元素卸载失效 */
    }
    resetGlobal()
    setSidebarWidth(width.current)
  }

  // 命中区 16px（w-4，原 6px w-1.5）：透明区两侧各 8px，左侧在侧栏内边距、右侧在内容面
  // 的页面内边距之外；视觉线仍是居中的 0.5px，不遮挡正文可点控件
  return (
    <div
      data-slot="sidebar-resizer"
      role="separator"
      aria-orientation="vertical"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="absolute inset-y-0 left-(--sidebar-width) z-20 hidden w-4 -translate-x-1/2 cursor-col-resize touch-none transition-[left] duration-200 ease-linear md:block"
    >
      <div className={LINE_CLASS} />
    </div>
  )
}
