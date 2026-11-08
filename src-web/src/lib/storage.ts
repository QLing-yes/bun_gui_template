// web 端持久化唯一门面：数据库定义、表与索引、幂等迁移、读写/批量提交、重试、跨窗口同步、首次导入、主题首帧提示
// 边界：其它模块只能经这里的异步 API 读写；禁止直连 IndexedDB / localStorage / sessionStorage（ESLint 已兜底）
// 内存为真源：读永远读内存镜像；写先改内存再排队落库，失败降级为 pending/error，不要求调用方等库确认
// 防抖分层：高频连续值由调用方在提交时写一次；中频偏好同键合并；登录态等关键键即时写
// 唯一例外：首次运行把历史 localStorage 一次性搬进 IndexedDB，搬迁成功后立即清理原键
// 首帧提示：IndexedDB 读不到，另用一枚极短 cookie 只承载最近一次主题档位（index.html 读取）
// 追加型数据（消息等）应按单条逻辑键入表增量写，禁止每次改动整包重写数组

import Dexie, { type Table } from "dexie"
import type { StateStorage } from "zustand/middleware"

/** 数据库名（同源唯一；版本升级由 Dexie schema 版本驱动） */
const DB_NAME = "aigc-web"
/** 当前 schema 版本（新增表/索引时抬升；数据迁移走幂等归一，不写逐版脚本） */
const SCHEMA_VERSION = 1
/** 已导入历史 localStorage 的标记键 */
const LEGACY_IMPORT_MARK = "__legacy_imported"
/** schema 版本元数据键（用于升级日志） */
const META_SCHEMA_VERSION = "__schema_version"
/** 主题首帧提示 cookie 名（与 index.html 内联脚本保持一致） */
const THEME_HINT_COOKIE = "aigc-theme"
/** 主题首帧提示 cookie 有效期（一年） */
const THEME_HINT_MAX_AGE = 60 * 60 * 24 * 365
/** 合法主题档位（cookie 只允许这三个值） */
const THEME_VALUES = new Set(["light", "dark", "system"])
/** 中频偏好默认防抖（ms）：同键只留最后一次 */
const DEFAULT_DEBOUNCE_MS = 300
/** 预判剩余空间阈值（字节）：低于此值暂不提交，保留内存数据并靠重试降级 */
const MIN_FREE_BYTES = 2 * 1024 * 1024
/** 落库失败最大重试次数 */
const MAX_RETRY = 5
/** 跨窗口变更广播频道名 */
const BROADCAST_CHANNEL = "aigc-web-storage"

/** 一条持久化记录 */
export interface StoredRecord {
  /** 逻辑键（沿用旧 localStorage 键名，便于一次性导入与排障） */
  key: string
  /** 原始字符串值（zustand JSON 载荷或裸值） */
  value: string
  /** 内容更新时间（ms）：后续同步按 updatedAt 增量挑数据 */
  updatedAt: number
  /** 脏标记（1=本地有未同步变更，0=已同步基线；当前无同步服务时新写一律 1） */
  dirty: 0 | 1
}

/** 存储启动阶段：数据库打开 → 版本检查/迁移 → 历史导入 → 数据装载 → store 水合 */
export type StoragePhase = "open" | "version" | "import" | "load" | "hydrate"

/** 持久化状态标记 */
export type StorageStatus = "idle" | "pending" | "saving" | "error"

/** 键变更来源：local=本窗口写入；remote=其它窗口广播回查后同步 */
export type StorageChangeSource = "local" | "remote"

/** 暴露给界面的持久化状态 */
export interface StorageState {
  /** 当前状态：空闲/待落库/落库中/失败 */
  status: StorageStatus
  /** 待落库键数 */
  pendingCount: number
  /** 最近一次失败原因；null=无错误 */
  error: string | null
}

/** 存储启动结果 */
export type StorageBoot = {
  /** 已落库的主题档位；null=从未存过（由 ThemeProvider 回落跟随系统） */
  theme: string | null
}

/** 写选项 */
export type WriteOptions = {
  /** 跳过防抖、尽快提交（关键数据用） */
  immediate?: boolean
}

/** 持久化键登记表；值一经发布不可改（改了等于丢用户数据），新增只加行 */
export const STORAGE_KEYS = {
  /** zustand UI store：侧栏模式/宽度 + 磨砂三项 + 窗口四角 */
  ui: "aigc-ui",
  /** zustand 鉴权 store：username */
  auth: "aigc-auth",
  /** 明暗偏好，裸字符串值 */
  theme: "theme",
  /** 设置页分栏布局 id（落盘键由本模块补 react-resizable-panels 前缀） */
  settingsLayout: "aigc-settings-split",
  /** 层级检视器悬浮按钮位置（键由 src/dev/layer-inspector.ts 自持） */
  layerInspector: "dlx:pos",
} as const

/** 设置页分栏布局的实际落盘键（保持与旧 localStorage 键一致，历史值可直接续用） */
export const SETTINGS_LAYOUT_KEY = `react-resizable-panels:${STORAGE_KEYS.settingsLayout}`

/** 按键的防抖时长：0=即时；未登记走默认；高频连续值由调用方在提交时写一次 */
const DEBOUNCE_BY_KEY: Record<string, number> = {
  [STORAGE_KEYS.auth]: 0,
  [STORAGE_KEYS.theme]: 0,
  [STORAGE_KEYS.ui]: 400,
  [SETTINGS_LAYOUT_KEY]: 400,
  [STORAGE_KEYS.layerInspector]: 0,
}

/** 持久化状态（当前快照） */
let storageState: StorageState = { status: "idle", pendingCount: 0, error: null }
/** 状态订阅者 */
const stateListeners = new Set<(state: StorageState) => void>()
/** 阶段订阅者 */
const phaseListeners = new Set<(phase: StoragePhase) => void>()
/** 键订阅者 */
const keyListeners = new Map<string, Set<(value: string | null) => void>>()
/** 全局键变更订阅者（带来源，供上层统一分发到各 store） */
const changeListeners = new Set<
  (key: string, value: string | null, source: StorageChangeSource) => void
>()

/** 更新状态并广播 @param patch 局部字段 */
function setStorageState(patch: Partial<StorageState>): void {
  storageState = { ...storageState, ...patch }
  for (const listener of stateListeners) listener(storageState)
}

/** 记录当前启动阶段并广播 @param phase 新阶段 */
function emitPhase(phase: StoragePhase): void {
  for (const listener of phaseListeners) listener(phase)
}

/** 通知某个键的订阅者 @param key 键 @param value 新值 @param source 变更来源 */
function notifyKey(
  key: string,
  value: string | null,
  source: StorageChangeSource
): void {
  const listeners = keyListeners.get(key)
  if (listeners) {
    for (const listener of listeners) listener(value)
  }
  for (const listener of changeListeners) listener(key, value, source)
}

/** IndexedDB 数据库定义 */
class AppDatabase extends Dexie {
  /** 全量键值记录表；dirty + updatedAt 供后续同步按增量挑数据 */
  records!: Table<StoredRecord, string>

  constructor() {
    super(DB_NAME)
    this.version(SCHEMA_VERSION).stores({
      records: "key, updatedAt, dirty",
    })
  }
}

/** 数据库单例 */
const db = new AppDatabase()

/** 已装载值镜像：读 API 只认这里（首次启动时由 DB 全量填充，写后同步更新） */
const cache = new Map<string, string>()
/** 待落库写入（键 → 最新值） */
const pendingPut = new Map<string, string>()
/** 待落库删除键 */
const pendingDelete = new Set<string>()
/** 每键防抖定时器 */
const timers = new Map<string, ReturnType<typeof setTimeout>>()
/** 启动 Promise（并发调用共享；失败后清空以便重试） */
let readyPromise: Promise<StorageBoot> | null = null
/** 正在进行的批量提交 */
let flushing: Promise<void> | null = null
/** 提交期间又有新写：完成后立刻再排空一次 */
let flushAgain = false
/** 重试次数 */
let retryAttempt = 0
/** 重试定时器 */
let retryTimer: ReturnType<typeof setTimeout> | null = null

/** 跨窗口变更广播（不支持的环境直接降级为单窗口） */
const channel =
  typeof BroadcastChannel === "undefined"
    ? null
    : new BroadcastChannel(BROADCAST_CHANNEL)

channel?.addEventListener("message", (event: MessageEvent<unknown>) => {
  const data = event.data as { keys?: unknown } | null
  if (!data || !Array.isArray(data.keys)) return
  void syncFromDatabase(data.keys.filter((key): key is string => typeof key === "string"))
})

/** 开发环境日志 @param args 日志内容 */
function debug(...args: unknown[]): void {
  if (import.meta.env.DEV) console.debug(...args)
}

/** 开发环境错误日志 @param args 日志内容 */
function debugError(...args: unknown[]): void {
  if (import.meta.env.DEV) console.error(...args)
}

/** 写主题首帧提示 cookie；null=清除过期提示，非法值忽略 @param theme 主题档位 */
function writeThemeHint(theme: string | null): void {
  if (theme !== null && !THEME_VALUES.has(theme)) return
  try {
    document.cookie =
      theme === null
        ? `${THEME_HINT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
        : `${THEME_HINT_COOKIE}=${theme}; Path=/; Max-Age=${THEME_HINT_MAX_AGE}; SameSite=Lax`
  } catch {
    /* cookie 不可用只影响首帧提示，不影响持久化 */
  }
}

/** 取某键的防抖时长 @param key 键 @returns 毫秒 */
function debounceFor(key: string): number {
  return DEBOUNCE_BY_KEY[key] ?? DEFAULT_DEBOUNCE_MS
}

/** 预判剩余空间是否足够（不支持估算的环境直接放行） @returns 是否可提交 */
async function hasFreeSpace(): Promise<boolean> {
  try {
    if (!navigator.storage?.estimate) return true
    const { usage = 0, quota = 0 } = await navigator.storage.estimate()
    if (quota === 0) return true
    return quota - usage > MIN_FREE_BYTES
  } catch {
    return true
  }
}

/** 首次启动申请一次持久化存储许可（失败只降级为普通存储） */
async function requestPersistentStorage(): Promise<void> {
  try {
    if (!navigator.storage?.persist) return
    const granted = await navigator.storage.persist()
    debug("[storage] persistent permission", { granted })
  } catch (error) {
    debugError("[storage] persistent permission failed", error)
  }
}

/** 数据归一：补齐 dirty/updatedAt 等字段；幂等，可从任意旧版本直接升到最新 @returns 是否发生变更 */
async function migrateRecordsToLatest(): Promise<boolean> {
  const rows = await db.records.toArray()
  /** 需要补齐的记录 */
  const stale = rows.filter(
    (row) =>
      (row.dirty !== 0 && row.dirty !== 1) || !Number.isFinite(row.updatedAt)
  )
  if (stale.length === 0) return false

  await db.transaction("rw", db.records, async () => {
    await db.records.bulkPut(
      stale.map((row) => ({
        ...row,
        dirty: row.dirty === 0 ? 0 : 1,
        updatedAt: Number.isFinite(row.updatedAt) ? row.updatedAt : Date.now(),
      }))
    )
  })
  return true
}

/** 首次运行把历史 localStorage 全量导入 IndexedDB，成功后再清理原键 */
async function importLegacyKeys(): Promise<void> {
  const imported = await db.records.get(LEGACY_IMPORT_MARK)
  if (imported) return

  /** 待搬迁键 */
  const keys: string[] = []
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key && key !== LEGACY_IMPORT_MARK) keys.push(key)
    }
  } catch (error) {
    debugError("[storage] legacy scan failed", error)
  }

  /** 已读到的记录 */
  const rows: StoredRecord[] = []
  /** 读取失败的条数 */
  let failed = 0
  const updatedAt = Date.now()
  for (const key of keys) {
    try {
      const value = localStorage.getItem(key)
      if (value === null) {
        failed += 1
        continue
      }
      rows.push({ key, value, updatedAt, dirty: 1 })
    } catch {
      failed += 1
    }
  }

  try {
    await db.transaction("rw", db.records, async () => {
      await db.records.bulkPut(rows)
      await db.records.put({
        key: LEGACY_IMPORT_MARK,
        value: String(updatedAt),
        updatedAt,
        dirty: 0,
      })
    })
  } catch (error) {
    debugError("[storage] legacy import failed", error)
    return
  }

  /** 清理失败的条数 */
  let cleanupFailed = 0
  for (const key of keys) {
    try {
      localStorage.removeItem(key)
    } catch {
      cleanupFailed += 1
    }
  }

  debug("[storage] legacy import", {
    imported: rows.length,
    failed: failed + cleanupFailed,
  })
}

/** 打开数据库、申请许可、幂等迁移、导入历史数据并装载缓存 */
async function bootStorage(): Promise<StorageBoot> {
  const started = performance.now()
  emitPhase("open")
  await db.open()
  debug("[storage] db opened", { version: db.verno })
  await requestPersistentStorage()

  emitPhase("version")
  const previousVersion = Number(
    (await db.records.get(META_SCHEMA_VERSION))?.value ?? 0
  )
  if (previousVersion !== db.verno) {
    debug("[storage] schema version", { from: previousVersion, to: db.verno })
    await db.records.put({
      key: META_SCHEMA_VERSION,
      value: String(db.verno),
      updatedAt: Date.now(),
      dirty: 0,
    })
  }
  const migrated = await migrateRecordsToLatest()
  if (migrated) debug("[storage] records migrated to latest")

  emitPhase("import")
  await importLegacyKeys()

  emitPhase("load")
  const rows = await db.records.toArray()
  cache.clear()
  for (const row of rows) cache.set(row.key, row.value)
  // 重试启动时未落库的内存写比库里旧值新，装载后必须盖回，否则用户刚改的值会跳变
  for (const [key, value] of pendingPut) cache.set(key, value)
  for (const key of pendingDelete) cache.delete(key)
  const theme = cache.get(STORAGE_KEYS.theme) ?? null
  // 历史主题导入后立刻刷新首帧提示；无记录时清掉可能残留的旧 cookie
  writeThemeHint(theme)
  debug("[storage] data loaded", {
    records: rows.length,
    ms: Math.round(performance.now() - started),
  })

  return { theme }
}

/** 启动持久化层；并发调用共享同一 Promise，失败后允许重试 @returns 启动结果 */
export function initStorage(): Promise<StorageBoot> {
  if (!readyPromise) {
    readyPromise = bootStorage().catch((error) => {
      readyPromise = null
      debugError("[storage] boot failed", error)
      throw error
    })
  }
  return readyPromise
}

/** 订阅启动阶段 @param listener 阶段回调 @returns 退订函数 */
export function subscribeStoragePhase(
  listener: (phase: StoragePhase) => void
): () => void {
  phaseListeners.add(listener)
  return () => {
    phaseListeners.delete(listener)
  }
}

/** 订阅持久化状态（pending/saving/error） @param listener 状态回调 @returns 退订函数 */
export function subscribeStorageState(
  listener: (state: StorageState) => void
): () => void {
  stateListeners.add(listener)
  return () => {
    stateListeners.delete(listener)
  }
}

/** 获取当前持久化状态快照 @returns 状态 */
export function getStorageState(): StorageState {
  return storageState
}

/** 订阅某个键的变更（本地提交与跨窗口同步都会触发） @param key 键 @param listener 回调 @returns 退订函数 */
export function subscribeStorageKey(
  key: string,
  listener: (value: string | null) => void
): () => void {
  let listeners = keyListeners.get(key)
  if (!listeners) {
    listeners = new Set()
    keyListeners.set(key, listeners)
  }
  listeners.add(listener)
  return () => {
    listeners?.delete(listener)
  }
}

/** 订阅全局键变更（区分本地写入与跨窗口同步） @param listener 变更回调 @returns 退订函数 */
export function subscribeStorageChange(
  listener: (
    key: string,
    value: string | null,
    source: StorageChangeSource
  ) => void
): () => void {
  changeListeners.add(listener)
  return () => {
    changeListeners.delete(listener)
  }
}

/** 跨窗口收到变更后回查数据库，刷新内存镜像并通知界面 @param keys 变更键 */
async function syncFromDatabase(keys: string[]): Promise<void> {
  if (keys.length === 0) return
  try {
    await initStorage()
    const rows = await db.records.bulkGet(keys)
    keys.forEach((key, index) => {
      // 本窗口还有未落库写入时本地更新，不能被远端旧值覆盖
      if (pendingPut.has(key) || pendingDelete.has(key)) return
      const next = rows[index]?.value ?? null
      const current = cache.get(key) ?? null
      if (next === current) return
      if (next === null) cache.delete(key)
      else cache.set(key, next)
      notifyKey(key, next, "remote")
    })
    debug("[storage] remote sync", { keys })
  } catch (error) {
    debugError("[storage] remote sync failed", { keys, error })
  }
}

/** 广播本地变更，让其它窗口回查 @param keys 变更键 */
function broadcast(keys: string[]): void {
  if (!channel || keys.length === 0) return
  try {
    channel.postMessage({ keys })
  } catch (error) {
    debugError("[storage] broadcast failed", error)
  }
}

/** 异步读取原始字符串值；只读内存镜像，不等库确认 @param key 逻辑键 @returns 存储值；没有记录返回 null */
export async function readText(key: string): Promise<string | null> {
  await initStorage()
  return cache.get(key) ?? null
}

/** 标记有待落库并广播状态 @param key 刚写入的键 @param immediate 是否跳过防抖 */
function markPending(key: string, immediate: boolean): void {
  setStorageState({
    status: "pending",
    pendingCount: pendingPut.size + pendingDelete.size,
  })
  const existing = timers.get(key)
  if (existing) clearTimeout(existing)
  const delay = immediate ? 0 : debounceFor(key)
  if (delay <= 0) {
    timers.delete(key)
    void flushStorage()
    return
  }
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key)
      void flushStorage()
    }, delay)
  )
}

/** 异步写原始字符串值；先更新内存，再按键防抖批量落库 @param key 逻辑键 @param value 待存值 @param options 写选项 */
export async function writeText(
  key: string,
  value: string,
  options: WriteOptions = {}
): Promise<void> {
  // 内存为真源：库暂时不可用不影响写入语义，只降级为「有未落盘」，等重试启动后补
  try {
    await initStorage()
  } catch {
    /* 失败原因已由 initStorage 记录；此处只保留内存与待落库队列 */
  }
  cache.set(key, value)
  if (key === STORAGE_KEYS.theme) writeThemeHint(value)
  pendingDelete.delete(key)
  pendingPut.set(key, value)
  markPending(key, options.immediate === true)
  notifyKey(key, value, "local")
}

/** 异步删键；删除按关键数据即时提交 @param key 逻辑键 */
export async function removeText(key: string): Promise<void> {
  try {
    await initStorage()
  } catch {
    /* 同 writeText：删除只落内存与待落库队列 */
  }
  cache.delete(key)
  pendingPut.delete(key)
  pendingDelete.add(key)
  const existing = timers.get(key)
  if (existing) clearTimeout(existing)
  timers.delete(key)
  setStorageState({
    status: "pending",
    pendingCount: pendingPut.size + pendingDelete.size,
  })
  void flushStorage()
  notifyKey(key, null, "local")
}

/** 清理重试状态 */
function resetRetry(): void {
  retryAttempt = 0
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
}

/** 指数退避重试；超过上限保留 error 状态与内存数据 @param error 失败原因 */
function scheduleRetry(error: unknown): void {
  if (retryAttempt >= MAX_RETRY) {
    debugError("[storage] retry exhausted", {
      attempts: retryAttempt,
      pending: pendingPut.size + pendingDelete.size,
      error,
    })
    return
  }
  const delay = Math.min(500 * 2 ** retryAttempt, 30_000)
  retryAttempt += 1
  debugError("[storage] flush failed, retry scheduled", {
    attempt: retryAttempt,
    delay,
    error,
  })
  if (retryTimer) return
  retryTimer = setTimeout(() => {
    retryTimer = null
    void flushStorage()
  }, delay)
}

/** 把快照放回待落库表（只补尚未被更新值覆盖的键） @param puts 写入快照 @param deletes 删除快照 */
function requeue(
  puts: Array<[string, string]>,
  deletes: string[]
): void {
  for (const [key, value] of puts) {
    if (!pendingPut.has(key)) pendingPut.set(key, value)
  }
  for (const key of deletes) {
    if (!pendingPut.has(key) && !pendingDelete.has(key)) pendingDelete.add(key)
  }
}

/** 一次事务批量提交当前所有待落库键；失败保留内存并指数退避 @returns 提交完成 */
async function doFlush(): Promise<void> {
  try {
    await initStorage()
  } catch {
    // 数据库不可用：保留内存与待落库队列，状态如实标记，不向调用方抛
    setStorageState({
      status: "error",
      pendingCount: pendingPut.size + pendingDelete.size,
      error: "本地数据库不可用",
    })
    return
  }
  /** 写入快照 */
  const puts = Array.from(pendingPut.entries())
  /** 删除快照 */
  const deletes = Array.from(pendingDelete)
  if (puts.length === 0 && deletes.length === 0) {
    setStorageState({ status: "idle", pendingCount: 0 })
    return
  }

  pendingPut.clear()
  pendingDelete.clear()
  setStorageState({
    status: "saving",
    pendingCount: puts.length + deletes.length,
  })

  try {
    if (!(await hasFreeSpace())) {
      requeue(puts, deletes)
      setStorageState({
        status: "error",
        pendingCount: pendingPut.size + pendingDelete.size,
        error: "本地存储空间不足",
      })
      scheduleRetry(new Error("insufficient free space"))
      return
    }

    const updatedAt = Date.now()
    await db.transaction("rw", db.records, async () => {
      if (puts.length > 0) {
        await db.records.bulkPut(
          puts.map(([key, value]) => ({ key, value, updatedAt, dirty: 1 as const }))
        )
      }
      if (deletes.length > 0) {
        await db.records.bulkDelete(deletes)
      }
    })

    resetRetry()
    // 提交期间可能又进了新写，状态按剩余队列如实标记，不谎报空闲
    const remaining = pendingPut.size + pendingDelete.size
    setStorageState({
      status: remaining > 0 ? "pending" : "idle",
      pendingCount: remaining,
      error: null,
    })
    broadcast([...puts.map(([key]) => key), ...deletes])
    debug("[storage] flush", { puts: puts.length, deletes: deletes.length })
  } catch (error) {
    requeue(puts, deletes)
    setStorageState({
      status: "error",
      pendingCount: pendingPut.size + pendingDelete.size,
      error: error instanceof Error ? error.message : String(error),
    })
    scheduleRetry(error)
  }
}

/** 立即提交所有待落库数据（按表合并为一次事务） @returns 提交完成 */
export function flushStorage(): Promise<void> {
  if (flushing) {
    flushAgain = true
    return flushing
  }
  flushing = doFlush().finally(() => {
    flushing = null
    if (flushAgain) {
      flushAgain = false
      void flushStorage()
    }
  })
  return flushing
}

/** zustand persist 的异步存储适配器：JSON 序列化由 persist 负责，关键键按防抖表即时写 */
export const storageAdapter: StateStorage = {
  getItem: readText,
  setItem: (key, value) => writeText(key, value),
  removeItem: removeText,
}

// 页面隐藏/卸载时把待落库队列立刻推一次：异步写入不保证落盘，缩短丢失窗口
if (typeof window !== "undefined") {
  const flushOnExit = (): void => {
    if (!readyPromise) return
    void flushStorage()
  }
  window.addEventListener("pagehide", flushOnExit)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushOnExit()
  })
}
