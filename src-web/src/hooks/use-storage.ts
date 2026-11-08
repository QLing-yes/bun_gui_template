// 持久化上层钩子：水合闸门（打开/迁移/导入完成前显示骨架）+ 单键持久化状态（值 + 加载态/保存态）
// 钩子只消费 lib/storage 的异步 API 与订阅，不直接触碰任何浏览器存储

import { useEffect, useRef, useState } from "react"

import {
  flushStorage,
  getStorageState,
  initStorage,
  readText,
  subscribeStorageKey,
  subscribeStoragePhase,
  subscribeStorageState,
  type StorageBoot,
  type StoragePhase,
  type StorageState,
} from "@/lib/storage"

/** 单键加载态 */
export type PersistedLoadStatus = "loading" | "ready" | "error"

/** 单键保存态（与全局持久化状态同构） */
export type PersistedSaveStatus = StorageState["status"]

/** 数据库打开失败自动重试上限（次） */
const BOOT_RETRY_MAX = 5
/** 自动重试基础间隔（ms） */
const BOOT_RETRY_BASE_MS = 1000
/** 自动重试间隔上限（ms） */
const BOOT_RETRY_CAP_MS = 15_000

/** 把未知错误收敛成 Error @param error 原始错误 @returns 可展示错误 */
function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

/** 水合闸门：数据库打开、版本迁移、首次导入、缓存装载完成前 ready=false @returns 阶段/结果/错误/重试 */
export function useStorageHydration(): {
  /** 当前启动阶段 */
  phase: StoragePhase
  /** 启动结果；null=未就绪 */
  boot: StorageBoot | null
  /** 启动是否完成 */
  ready: boolean
  /** 启动失败原因 */
  error: Error | null
  /** 是否正在等待下一次自动重试 */
  retrying: boolean
  /** 重试启动（手动立即重试，重置退避计数） */
  retry: () => void
} {
  const [boot, setBoot] = useState<StorageBoot | null>(null)
  const [phase, setPhase] = useState<StoragePhase>("open")
  const [error, setError] = useState<Error | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [attempt, setAttempt] = useState(0)
  /** 已安排的自动重试次数（成功或手动重试时归零） */
  const autoAttemptRef = useRef(0)

  useEffect(() => {
    let alive = true
    /** 本次尝试的自动重试定时器 */
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    // 先启动再订阅：open 阶段同步发出，初始 phase 已是 open；后续阶段都在 await 之后异步到达
    initStorage()
      .then((result) => {
        if (!alive) return
        if (import.meta.env.DEV && autoAttemptRef.current > 0) {
          console.debug("[boot] storage recovered after retry", {
            attempts: autoAttemptRef.current,
          })
        }
        autoAttemptRef.current = 0
        setRetrying(false)
        setError(null)
        setBoot(result)
      })
      .catch((reason) => {
        if (!alive) return
        setBoot(null)
        setError(toError(reason))

        const next = autoAttemptRef.current + 1
        if (next > BOOT_RETRY_MAX) {
          setRetrying(false)
          if (import.meta.env.DEV) {
            console.error("[boot] auto retry exhausted", {
              attempts: BOOT_RETRY_MAX,
            })
          }
          return
        }
        autoAttemptRef.current = next
        const delay = Math.min(
          BOOT_RETRY_BASE_MS * 2 ** (next - 1),
          BOOT_RETRY_CAP_MS
        )
        setRetrying(true)
        if (import.meta.env.DEV) {
          console.debug("[boot] auto retry scheduled", { attempt: next, delay })
        }
        retryTimer = setTimeout(() => {
          if (alive) setAttempt((value) => value + 1)
        }, delay)
      })
    const unsubscribe = subscribeStoragePhase((next) => {
      if (alive) setPhase(next)
    })
    return () => {
      alive = false
      if (retryTimer) clearTimeout(retryTimer)
      unsubscribe()
    }
  }, [attempt])

  const retry = () => {
    autoAttemptRef.current = 0
    setBoot(null)
    setError(null)
    setRetrying(false)
    setPhase("open")
    setAttempt((value) => value + 1)
  }

  return { phase, boot, ready: boot !== null, error, retrying, retry }
}

/** 单键持久化状态钩子：读内存真源；加载态与保存态分开，界面各按所需取用 @param key 逻辑键 */
export function usePersistedValue(key: string): {
  /** 当前值；未加载完为 null */
  value: string | null
  /** 加载态：loading/ready/error（error 时 value 不可信） */
  loadStatus: PersistedLoadStatus
  /** 保存态：idle/pending/saving/error（写入降级用，不影响展示） */
  saveStatus: PersistedSaveStatus
  /** 读取或写入失败后的重试入口 */
  retry: () => void
} {
  const [value, setValue] = useState<string | null>(null)
  const [loadStatus, setLoadStatus] = useState<PersistedLoadStatus>("loading")
  const [storageState, setStorageState] = useState<StorageState>(getStorageState)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    readText(key)
      .then((next) => {
        if (!alive) return
        setValue(next)
        setLoadStatus("ready")
      })
      .catch(() => {
        if (alive) setLoadStatus("error")
      })
    const unsubscribeKey = subscribeStorageKey(key, (next) => {
      if (!alive) return
      setValue(next)
      setLoadStatus("ready")
    })
    const unsubscribeState = subscribeStorageState((next) => {
      if (alive) setStorageState(next)
    })
    return () => {
      alive = false
      unsubscribeKey()
      unsubscribeState()
    }
  }, [key, attempt])

  const retry = () => {
    // 加载失败重新走 init/read；写入失败的待落库数据顺带再推一次
    setLoadStatus("loading")
    setAttempt((value) => value + 1)
    void flushStorage()
  }

  return { value, loadStatus, saveStatus: storageState.status, retry }
}
