// WebView 全局输入守卫：拦截类与热键类条目全部取自 shortcuts/registry（键位不再二次硬编码）

import { toggleMaximizeWindow } from "@/lib/tauri"
import {
  comboMatches,
  effectiveShortcuts,
  shortcutById,
} from "@/shortcuts/registry"

/** 热键 id → 行为；与 registry 中 kind="hotkey" 的桌面条目一一对应 */
const hotkeyActions: Record<string, () => void> = {
  maximize: toggleMaximizeWindow,
}

/** 安装 WebView 全局输入守卫：文件拖入两端通用；其余条目按清单生效端过滤后安装 */
export function installWebviewGuards(): void {
  document.addEventListener("dragover", (e) => e.preventDefault())
  document.addEventListener("drop", (e) => e.preventDefault())

  const entries = effectiveShortcuts()

  // 清单里有右键拦截条目才挂守卫（当前为桌面专属）
  if (shortcutById("contextmenu")) {
    document.addEventListener("contextmenu", (e) => e.preventDefault())
  }

  const blocked = entries.filter((e) => e.kind === "block")
  const hotkeys = entries.filter(
    (e) => e.kind === "hotkey" && hotkeyActions[e.id]
  )
  if (!blocked.length && !hotkeys.length) return

  document.addEventListener("keydown", (e) => {
    if (blocked.some((entry) => entry.combos.some((c) => comboMatches(c, e)))) {
      e.preventDefault()
      return
    }
    const hit = hotkeys.find((entry) =>
      entry.combos.some((c) => comboMatches(c, e))
    )
    if (!hit) return
    e.preventDefault()
    hotkeyActions[hit.id]()
  })
}
