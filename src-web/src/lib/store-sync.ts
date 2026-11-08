// 跨窗口 store 同步：订阅关系只在这里登记一次
// 广播到达并回查库后，按「持久化键 → store」映射把远端值灌回对应 store
// 回环防护：zustand persist 的 rehydrate 走内部 set，不会触发 setItem，因此不会「写入 → 广播 → 再写入」
// 兜底：出现像 persist 载荷（{ state, version }）却没有登记的键时，开发环境告警一次

import { subscribeStorageChange, STORAGE_KEYS } from "@/lib/storage"
import { useAuthStore } from "@/store/auth"
import { useUiStore } from "@/store/ui"

/** 持久化键 → store 灌入动作（新增持久化 store 必须在此登记） */
const STORE_SYNC: Record<string, () => Promise<void> | void> = {
  [STORAGE_KEYS.ui]: () => useUiStore.persist.rehydrate(),
  [STORAGE_KEYS.auth]: () => useAuthStore.persist.rehydrate(),
}

/** 已告警过的键（避免每次写入刷屏） */
const warnedKeys = new Set<string>()

/** 是否已安装 */
let installed = false

/** 判断值是否像 zustand persist 载荷 @param value 原始字符串 @returns 是否像持久化 store 数据 */
function looksPersisted(value: string): boolean {
  try {
    const parsed = JSON.parse(value) as { state?: unknown; version?: unknown } | null
    return (
      parsed !== null &&
      typeof parsed === "object" &&
      "state" in parsed &&
      "version" in parsed
    )
  } catch {
    return false
  }
}

/** 安装跨窗口 store 同步（幂等，应用生命周期内只装一次） */
export function installStoreSync(): void {
  if (installed) return
  installed = true

  subscribeStorageChange((key, value, source) => {
    const apply = STORE_SYNC[key]
    if (apply) {
      // 只处理远端变更；本窗口写自己的 store 会回声同值，灌入既无意义也可能惊扰输入
      if (source !== "remote") return
      if (import.meta.env.DEV) {
        console.debug("[store-sync] apply remote change", { key })
      }
      void apply()
      return
    }

    // 兜底：新增持久化 store 忘了登记时，至少能在开发环境看到告警
    if (
      import.meta.env.DEV &&
      value !== null &&
      !warnedKeys.has(key) &&
      looksPersisted(value)
    ) {
      warnedKeys.add(key)
      console.warn("[store-sync] persisted key has no store subscription", { key })
    }
  })
}
