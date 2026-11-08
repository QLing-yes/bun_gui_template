// web 端持久化的唯一门面：键名登记、裸值读写、按 key 防抖落盘、生命周期强制 flush 都在这里
// 边界：zustand persist 经 storageAdapter 走同一层防抖；第三方库自管的键只登记索引，不反向接管
// 例外：src/dev/layer-inspector.ts 是可整体拷走的零依赖单文件，其自身位置存档仍直连原生存储

import type { StateStorage } from "zustand/middleware"

/** 写盘防抖窗口（ms）：同一键在窗口期内只落一次，拖动滑杆等高频写不再逐帧阻塞主线程 */
const FLUSH_DELAY_MS = 200

/** 持久化键登记表；值一经发布不可改（改了等于丢用户数据），新增只加行 */
export const STORAGE_KEYS = {
  /** zustand UI store：侧栏模式/宽度 + 磨砂三项 + 窗口四角 */
  ui: "aigc-ui",
  /** zustand 鉴权 store：username */
  auth: "aigc-auth",
  /** 明暗偏好，裸字符串值 */
  theme: "theme",
  /** 设置页分栏布局 id，react-resizable-panels 自加前缀落盘为 `react-resizable-panels:<id>` */
  settingsLayout: "aigc-settings-split",
  /** 层级检视器悬浮按钮位置，键由 src/dev/layer-inspector.ts 自持（该文件跨项目零依赖，不引本模块） */
  layerInspector: "dlx:pos",
} as const

/** 待落盘值（键 → 最新值），窗口期内后来的写覆盖前者 */
const pending = new Map<string, string>()
/** 每键的防抖定时器 */
const timers = new Map<string, number>()
/** 已落盘值镜像：同值写入直接丢弃，省掉无谓的同步 IO 与跨标签页事件 */
const written = new Map<string, string>()

/** 立即把单个键写进原生存储（内部用，调用前定时器已撤） @param key 存储键 */
function commit(key: string): void {
  const value = pending.get(key)
  pending.delete(key)
  if (value === undefined || value === written.get(key)) return
  try {
    localStorage.setItem(key, value)
    written.set(key, value)
    if (import.meta.env.DEV) console.debug("[storage] commit", { key, bytes: value.length })
  } catch {
    /* 隐私模式/配额失败一律静默：持久化是增强，不是功能前提 */
  }
}

/** 读裸字符串；同页面尚未落盘的最新值优先 @param key 存储键 @returns 存过的值；没存过或存储不可用返回 null */
export function readText(key: string): string | null {
  const draft = pending.get(key)
  if (draft !== undefined) return draft
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** 防抖写裸字符串：窗口期内同键只落盘一次 @param key 存储键 @param value 待存值 */
export function writeText(key: string, value: string): void {
  if (!pending.has(key) && value === written.get(key)) return
  pending.set(key, value)
  if (timers.has(key)) return
  timers.set(
    key,
    window.setTimeout(() => {
      timers.delete(key)
      commit(key)
    }, FLUSH_DELAY_MS)
  )
}

/** 立即落盘：省略 key 即全量；页面隐藏/卸载与读后即写的场景用 @param key 可选存储键 */
export function flushStorage(key?: string): void {
  if (key === undefined) {
    for (const [k, timer] of timers) {
      window.clearTimeout(timer)
      commit(k)
    }
    timers.clear()
    for (const k of [...pending.keys()]) commit(k)
    return
  }
  const timer = timers.get(key)
  if (timer !== undefined) window.clearTimeout(timer)
  timers.delete(key)
  commit(key)
}

/** 立即写单个键（跳过防抖窗口）：只用于必须马上可被读回的场景 @param key 存储键 @param value 待存值 */
export function writeTextNow(key: string, value: string): void {
  pending.set(key, value)
  flushStorage(key)
}

/** 删除键并丢弃其待落盘值 @param key 存储键 */
export function removeText(key: string): void {
  const timer = timers.get(key)
  if (timer !== undefined) window.clearTimeout(timer)
  timers.delete(key)
  pending.delete(key)
  written.delete(key)
  try {
    localStorage.removeItem(key)
  } catch {
    /* 同 writeText：失败不影响本次会话 */
  }
}

/** 原生存储区引用：仅供 storage 事件源比对（事件监听不是读写，故不另开门面方法） */
export function storageArea(): Storage {
  return localStorage
}

/** zustand persist 的存储适配器：JSON 序列化由 persist 负责，落盘走本门面防抖 */
export const storageAdapter: StateStorage = {
  getItem: readText,
  setItem: writeText,
  removeItem: removeText,
}

/** 页面隐藏/卸载前强制落盘：切后台、关窗、刷新都不丢最后一个防抖窗口
 * （模块级单例；用 window 标记防止 HMR 重复挂载） */
function bindFlushHooks(): void {
  if (typeof window === "undefined") return
  const FLAG = "__aigcStorageFlushBound"
  const scope = window as unknown as Record<string, unknown>
  if (scope[FLAG]) return
  scope[FLAG] = true

  window.addEventListener("pagehide", () => flushStorage())
  window.addEventListener("beforeunload", () => flushStorage())
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushStorage()
  })
}

bindFlushHooks()
