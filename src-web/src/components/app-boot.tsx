// 应用启动闸门：先完成 IndexedDB 打开/版本检查/历史导入/缓存装载，再显式水合 zustand，最后放行整棵应用
// 加载态：前 300ms 不画骨架避免闪一下；超过阈值仍没就绪则铺整页骨架，并用阶段文案说明进度
// 错误态：读取失败显示带重试入口的错误卡，不静默留空白

import { useEffect, useState } from "react"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useStorageHydration } from "@/hooks/use-storage"
import type { StorageBoot, StoragePhase } from "@/lib/storage"
import { installStoreSync } from "@/lib/store-sync"
import { useAuthStore } from "@/store/auth"
import { useProjectsStore } from "@/store/projects"
import { useUiStore } from "@/store/ui"

/** 骨架延迟出现阈值（ms）：短于此时长直接不画，避免闪屏 */
const SKELETON_DELAY_MS = 300

/** 启动阶段文案（配合整页骨架，不单独用裸转圈文字） */
const PHASE_LABELS: Record<StoragePhase, string> = {
  open: "正在打开本地数据库",
  version: "正在检查数据版本",
  import: "正在迁移历史数据",
  load: "正在读取本地数据",
  hydrate: "正在恢复界面状态",
}

/** store 水合单例：并发/严格模式重复调用共享同一 Promise，失败后清空允许重试 */
let hydratePromise: Promise<void> | null = null

/** 显式水合所有 zustand persist store（自动水合已在 store 内关闭） @returns 水合完成 */
function hydrateStores(): Promise<void> {
  hydratePromise ??= (() => {
    // 先装跨窗口同步再水合：避免「水合读取」与「远端变更回查」之间的窗口漏掉一次灌入
    installStoreSync()
    return Promise.all([
      useUiStore.persist.rehydrate(),
      useAuthStore.persist.rehydrate(),
      useProjectsStore.persist.rehydrate(),
    ]).then(() => {
      if (import.meta.env.DEV) {
        console.debug("[boot] hydration complete")
      }
    })
  })().catch((error) => {
    hydratePromise = null
    throw error
  })
  return hydratePromise
}

/** 整页启动骨架：沿用页面骨架的比例与壳色底 @param phase 当前阶段 */
function BootSkeleton({ phase }: { phase: StoragePhase }) {
  return (
    <div
      className="flex h-svh flex-col gap-4 bg-shell p-4 sm:p-6"
      role="status"
      aria-live="polite"
    >
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-4 w-64" />
      <Skeleton className="h-44 w-full max-w-md rounded-lg" />
      <p className="text-sm text-muted-foreground">{PHASE_LABELS[phase]}</p>
    </div>
  )
}

/** 启动失败错误卡：展示原因并提供重试入口；等待自动重试期间追加提示
 * @param error 失败原因 @param retrying 是否正在等待自动重试 @param onRetry 手动重试回调 */
function BootError({
  error,
  retrying,
  onRetry,
}: {
  /** 失败原因 */
  error: Error
  /** 是否正在等待自动重试 */
  retrying: boolean
  /** 手动重试回调 */
  onRetry: () => void
}) {
  return (
    <div className="grid h-svh place-items-center bg-shell p-4 sm:p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>本地数据加载失败</CardTitle>
          <CardDescription>
            {error.message}
            {retrying && "；正在自动重试…"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onRetry}>重试</Button>
        </CardContent>
      </Card>
    </div>
  )
}

/** 把未知错误收敛成 Error @param error 原始错误 @returns 可展示错误 */
function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

/** 应用启动闸门 @param children 就绪后渲染整棵应用（接收初始主题） */
export function AppBoot({
  children,
}: {
  children: (boot: StorageBoot) => ReactNode
}) {
  /** 存储启动阶段/结果/错误/重试（打开→版本→导入→装载） */
  const storage = useStorageHydration()
  /** 已完成 zustand 水合的启动结果；与 boot 同一对象才视为就绪 */
  const [hydratedFor, setHydratedFor] = useState<StorageBoot | null>(null)
  /** store 水合失败原因 */
  const [hydrateError, setHydrateError] = useState<Error | null>(null)
  /** 是否已超过骨架延迟阈值 */
  const [showSkeleton, setShowSkeleton] = useState(false)
  /** 重试计数（变化即重置骨架计时） */
  const [attempt, setAttempt] = useState(0)

  // 骨架阈值：短于 300ms 不出现，避免闪一下
  useEffect(() => {
    const timer = window.setTimeout(() => setShowSkeleton(true), SKELETON_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [attempt])

  // 数据库装载完成后显式水合 store；水合完成前不放行应用
  useEffect(() => {
    const boot = storage.boot
    if (!boot || hydratedFor === boot) return
    let alive = true
    hydrateStores()
      .then(() => {
        if (alive) setHydratedFor(boot)
      })
      .catch((reason) => {
        if (alive) setHydrateError(toError(reason))
      })
    return () => {
      alive = false
    }
  }, [storage.boot, hydratedFor])

  /** 重试：清空错误与已水合标记，重新走存储启动与 store 水合 */
  const retry = () => {
    setHydrateError(null)
    setHydratedFor(null)
    setShowSkeleton(false)
    setAttempt((value) => value + 1)
    storage.retry()
  }

  const error = storage.error ?? hydrateError
  if (error) {
    return (
      <BootError error={error} retrying={storage.retrying} onRetry={retry} />
    )
  }

  const boot = storage.boot
  // 存储已就绪但 store 尚未水合时，阶段文案落在 hydrate
  const phase: StoragePhase = boot ? "hydrate" : storage.phase
  if (!boot || hydratedFor !== boot) {
    return showSkeleton ? <BootSkeleton phase={phase} /> : null
  }
  return children(boot)
}
