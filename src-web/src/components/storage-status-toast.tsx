// 运行期落库失败的全局轻提示：非阻塞、同一失败合并为一条、重试成功后自动收起
// 只消费 lib/storage 的状态订阅与重试入口，不直连任何浏览器存储

import { useEffect } from "react"

import { toast } from "@/components/ui/toast"
import {
  flushStorage,
  getStorageState,
  subscribeStorageState,
  type StorageState,
} from "@/lib/storage"

/** 固定 toast id：连续失败只更新同一条，避免刷屏 */
const TOAST_ID = "storage-save-failed"

/** 显示或更新失败提示 @param pendingCount 待落库键数 @param error 失败原因 */
function showFailure(pendingCount: number, error: string | null): void {
  toast.add({
    id: TOAST_ID,
    type: "error",
    title: "保存失败",
    description: `${error ?? "本地数据未能写入"}${
      pendingCount > 0 ? `；${pendingCount} 项待重试` : ""
    }`,
    timeout: 0,
    actionProps: {
      children: "重试",
      onClick: () => {
        void flushStorage()
      },
    },
  })
}

/** 收起失败提示 */
function hideFailure(): void {
  toast.close(TOAST_ID)
}

/** 持久化失败提示出口：挂在 Toaster 旁，应用生命周期内只订阅一次 */
export function StorageStatusToast() {
  useEffect(() => {
    /** 当前是否已展示失败提示 */
    let shown = false
    /** 按状态决定展示/更新/收起 @param state 持久化状态 */
    const apply = (state: StorageState): void => {
      // 只有「有待落库数据」的失败才算运行期保存失败；启动失败由 AppBoot 错误卡负责
      if (state.status === "error" && state.pendingCount > 0) {
        shown = true
        showFailure(state.pendingCount, state.error)
        return
      }
      // 重试成功后状态回到 idle 才收起；saving/pending 期间保持可见，避免失败提示提前消失
      if (!shown || state.status !== "idle") return
      shown = false
      hideFailure()
      if (import.meta.env.DEV) {
        console.debug("[storage] save failure toast cleared")
      }
    }
    // 订阅不回放，挂载时补一次当前快照
    apply(getStorageState())
    return subscribeStorageState(apply)
  }, [])

  return null
}
