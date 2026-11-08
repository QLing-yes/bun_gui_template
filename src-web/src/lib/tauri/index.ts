import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { useSyncExternalStore } from "react"

/** 是否运行在 Tauri 环境（纯 web 部署时为 false，所有窗口能力降级为 no-op/默认值） */
export const isTauri = "__TAURI_INTERNALS__" in window

/** 当前窗口句柄（仅 Tauri 环境创建，避免浏览器触发 IPC） */
const appWindow = isTauri ? getCurrentWindow() : null

// --------------------------------- IPC 契约 ---------------------------------

/** Rust `generate_handler!` 注册的命令名（web 侧唯一出处；scripts/check_ipc.ts 比对三端一致性） */
export const IPC = {
  sidecarToken: "sidecar_token",
  revealWindow: "reveal_window",
  shellPlatform: "shell_platform",
} as const

/** Rust `emit` 的事件名 */
export const IPC_EVENT = {
  sidecarTerminated: "sidecar-terminated",
} as const

// --------------------------------- 窗口操作 ---------------------------------

/** web 首帧提交后的就绪信号：由 Rust 一次性完成还原最小化、显示、聚焦（浏览器 no-op） */
export async function revealWindow(): Promise<void> {
  if (!isTauri) return
  await invoke(IPC.revealWindow)
}

/** 最小化窗口（浏览器降级 no-op） */
export async function minimizeWindow(): Promise<void> {
  await appWindow?.minimize()
}

/** 切换最大化/还原（浏览器降级 no-op） */
export async function toggleMaximizeWindow(): Promise<void> {
  await appWindow?.toggleMaximize()
}

/** 关闭窗口（浏览器降级 no-op） */
export async function closeWindow(): Promise<void> {
  await appWindow?.close()
}

/** 开始拖动窗口（左键按住拖动区域时触发；浏览器降级 no-op） */
export function startDraggingWindow(): void {
  void appWindow?.startDragging()
}

/** 设置窗口总是置顶（浏览器降级 no-op）
 * @param on 是否置顶 */
export async function setAlwaysOnTop(on: boolean): Promise<void> {
  await appWindow?.setAlwaysOnTop(on)
}

/** 查询窗口是否置顶（浏览器返回 false）
 * @returns 是否置顶 */
export async function isAlwaysOnTop(): Promise<boolean> {
  return appWindow ? appWindow.isAlwaysOnTop() : Promise.resolve(false)
}

/** DWM 着色（任务栏缩略图/Alt-Tab 框）只在 Windows 有意义；mac/linux 传原生明暗会改写 prefers-color-scheme，故只在 Windows 动手 */
let isWindowsShell = isTauri && /Windows/i.test(navigator.userAgent)

// 平台真源是 Rust cfg（UA 只兜到首帧解析回来之前）；纠正后按当前 class 补同步一次
if (isTauri) {
  invoke<string>(IPC.shellPlatform)
    .then((os) => {
      const windows = os === "windows"
      if (windows === isWindowsShell) return
      isWindowsShell = windows
      if (windows)
        setWindowTheme(document.documentElement.classList.contains("dark"))
    })
    .catch(() => {})
}

/** 同步窗口原生明暗（非 Windows / 浏览器为 no-op）
 * @param dark 是否深色 */
export function setWindowTheme(dark: boolean): void {
  if (!isWindowsShell) return
  void appWindow?.setTheme(dark ? "dark" : "light").catch(() => {})
}

// --------------------------------- sidecar 令牌 ---------------------------------

/** 令牌缓存：仅缓存非空结果（Rust 在 sidecar 就绪后才下发，过早问到的空值不固化） */
let tokenPromise: Promise<string> | null = null

/** 丢弃令牌缓存（sidecar 退出时调用，下次请求会重新问一次） */
function resetTokenCache(): void {
  tokenPromise = null
}

/** 获取 sidecar 访问令牌（浏览器/开发模式恒为空串）
 * @returns 令牌；空串表示本地 sidecar 未就绪或不在桌面端 */
export function sidecarToken(): Promise<string> {
  if (!isTauri) return Promise.resolve("")
  return (tokenPromise ??= invoke<string>(IPC.sidecarToken)
    .then((t) => {
      if (!t) resetTokenCache()
      return t
    })
    .catch((e) => {
      console.warn("[tauri] sidecar_token 获取失败，降级为空串:", e)
      resetTokenCache()
      return ""
    }))
}

// --------------------------------- 窗口状态 ---------------------------------

/** 监听 sidecar 意外退出（浏览器返回空取消函数）
 * @param callback 退出回调 @param code 退出码（信号终止时为 null）
 * @returns 取消监听函数 Promise */
export function onSidecarTerminated(
  callback: (code: number | null) => void
): Promise<() => void> {
  if (!isTauri) return Promise.resolve(() => {})
  return listen<number | null>(IPC_EVENT.sidecarTerminated, (e) => {
    resetTokenCache()
    callback(e.payload)
  })
}

/** 窗口状态：仅最大化标志（四角半径归 store + 圆角通道，不在这里掺和） */
export interface WindowState {
  /** 是否最大化 */
  isMaximized: boolean
}

/** 全局唯一快照（不可变对象，变更时整体替换） */
let windowSnapshot: WindowState = { isMaximized: false }
const windowListeners = new Set<() => void>()
/** 是否已建立全局订阅（仅 Tauri 环境） */
let windowSubscribed = false

function emitWindow(next: WindowState) {
  windowSnapshot = next
  windowListeners.forEach((l) => l())
}

/** 首次消费时建立全局订阅：初始同步 + resize 最大化探测 */
function ensureWindowSubscription(): void {
  if (windowSubscribed || !appWindow) return
  windowSubscribed = true
  const win = appWindow
  win
    .isMaximized()
    .then((v) => emitWindow({ isMaximized: v }))
    .catch(() => {})
  // 事件回调不被 await：内部自吞异常，IPC 失败跳过本次同步，下次 resize 再覆盖
  win
    .onResized(async () => {
      try {
        const v = await win.isMaximized()
        // 值未变化跳过广播：拖窗期间 resize 高频，避免无谓 re-render
        if (v !== windowSnapshot.isMaximized) emitWindow({ isMaximized: v })
      } catch {
        /* 忽略：窗口销毁竞态等场景 */
      }
    })
    .catch(() => {})
}

function subscribeWindow(cb: () => void): () => void {
  windowListeners.add(cb)
  ensureWindowSubscription()
  return () => windowListeners.delete(cb)
}

/** 订阅窗口状态（模块级单源：全应用一条 IPC/事件链，useSyncExternalStore 共享快照）
 * @returns 当前窗口状态 */
export function useWindowState(): WindowState {
  return useSyncExternalStore(subscribeWindow, () => windowSnapshot)
}
