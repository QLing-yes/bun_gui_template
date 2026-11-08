// 明暗入口（标题栏/登录页顶栏/设置页/侧栏菜单共用）：三档选项切换，接线只此一处
// 选项表与切换事务在 hooks/use-theme-switch，控件形态在 components/option-switch
// 事务要等游标滑行结束再启动：滑行中起全屏快照会把游标冻住，观感就是卡

import type { SwitchOrigin } from "@/components/option-switch"
import { OptionSwitch, SLIDE_MS } from "@/components/option-switch"
import type { Theme } from "@/components/theme-provider"
import { THEME_ROWS, useThemeSwitch } from "@/hooks/use-theme-switch"

/** 明暗入口参数 */
type ThemeMenuProps = {
  /** 尺寸档：sm 用于标题栏/侧栏菜单这类窄位，default 用于设置页 */
  size?: "sm" | "default"
  /** 只显图标（窄位用） */
  iconOnly?: boolean
  /** 游标滑行结束后的收尾（侧栏菜单用它推迟收菜单） */
  onSlideDone?: () => void
  /** 滑行结束后再等的下限（侧栏菜单传浮层关闭时长） */
  settleExtraMs?: number
  /** 命中当前档时吞掉事件（侧栏菜单需要，避免空切误触发收菜单） */
  skipSame?: boolean
}

export function ThemeMenu({
  size = "sm",
  iconOnly = true,
  onSlideDone,
  settleExtraMs = 0,
  skipSame = false,
}: ThemeMenuProps) {
  const { shown, switchTo } = useThemeSwitch()

  /** 选中变化：同一档按 skipSame 决定是否吞掉，其余交给切换事务 @param next 目标档 @param at 被点选项中心 */
  const onChange = (next: string, at?: SwitchOrigin) => {
    if (skipSame && next === shown) return
    if (import.meta.env.DEV) {
      console.debug("[theme] switch", { from: shown, to: next, settleExtraMs })
    }
    // 侧栏菜单：游标滑完先收菜单，事务再等浮层消失（第四参），两段都不能省
    if (onSlideDone) window.setTimeout(onSlideDone, SLIDE_MS)
    switchTo(next as Theme, at, SLIDE_MS, settleExtraMs)
  }

  return (
    <OptionSwitch
      options={THEME_ROWS}
      value={shown}
      size={size}
      iconOnly={iconOnly}
      onChange={onChange}
    />
  )
}
