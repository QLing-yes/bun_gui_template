// 路由历史可用性：转出价库的账本快照，供标题栏前进/后退按钮与登录页返回入口判断尽头

import { useSyncExternalStore } from "react"

import { historySnapshot, subscribeHistory } from "@/lib/route-history"

/** 历史导航可用性 @returns canGoBack 可后退；canGoForward 可前进 */
export function useHistoryNav() {
  return useSyncExternalStore(
    subscribeHistory,
    historySnapshot,
    historySnapshot
  )
}
