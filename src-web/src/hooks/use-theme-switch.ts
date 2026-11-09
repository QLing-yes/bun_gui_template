// 明暗三选项的唯一来源：选项登记表（值/文案/图标）与切换事务（乐观档、动画起点、等动画结束、空转跳过、失败回滚）
// 标题栏与设置页的控件形态在 components/option-switch，侧栏菜单内嵌同一个控件；新增模式只改本表

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { useTheme, type Theme } from "@/components/theme-provider"
import {
  cancelSystemTransitions,
  startThemeTransition,
} from "@/lib/theme-transition"

/** 明暗选项登记项 */
type ThemeRow = {
  /** 存储值 */
  value: Theme
  /** 中文文案 */
  label: string
  /** 选项图标 */
  icon: typeof SunIcon
}

/** 三选项与展示顺序 */
export const THEME_ROWS: readonly ThemeRow[] = [
  { value: "light", label: "浅色", icon: SunIcon },
  { value: "dark", label: "深色", icon: MoonIcon },
  { value: "system", label: "跟随系统", icon: MonitorIcon },
]

/** 游标节点选择器（与 components/option-switch.tsx 的 data-slot 对齐） */
const CURSOR_SELECTOR = '[data-slot="option-switch-cursor"]'
/** 兜底上限的余量：transitionend 丢了也不能一直等 */
const SLIDE_GRACE_MS = 150

/**
 * 等游标滑行真正结束、再等一段下限时间才跑回调
 * 判据是游标自己的 transform 过渡结束事件（定时器会因掉帧、后台标签页、动画被跳过而与真实结束时刻错位），
 * settleMs 只当兜底上限；floorMs 用于「浮层收掉」这类必须再等一拍的场景。
 * @param settleMs 滑行时长上限（0＝没有滑行，直接按下限走）
 * @param floorMs 结束后再等的下限
 * @param run 到点执行 @returns 取消等待
 */
function afterCursorSlide(
  settleMs: number,
  floorMs: number,
  run: () => void
): () => void {
  let done = false
  let timer = 0
  let extra = 0
  /** 收摊：解监听、清两枚定时器 */
  const stop = () => {
    window.clearTimeout(timer)
    window.clearTimeout(extra)
    document.removeEventListener("transitionend", onEnd, true)
  }
  const finish = () => {
    if (done) return
    done = true
    stop()
    extra = window.setTimeout(run, floorMs)
  }
  const onEnd = (e: TransitionEvent) => {
    const el = e.target as HTMLElement | null
    if (el && el.matches(CURSOR_SELECTOR) && e.propertyName === "transform")
      finish()
  }
  if (settleMs <= 0) {
    timer = window.setTimeout(finish, floorMs)
    return stop
  }
  timer = window.setTimeout(finish, settleMs + SLIDE_GRACE_MS)
  document.addEventListener("transitionend", onEnd, true)
  return stop
}
/**
 * 明暗切换事务
 * @returns shown 展示档（乐观优先，provider 追上后交还）；switchTo(next, at?, settleMs?) 切到指定档，settleMs＝游标滑行上限
 */
export function useThemeSwitch() {
  const { theme, resolvedTheme, systemTheme, setTheme } = useTheme()
  /** 乐观档：点击当帧先换图标/选中态——切换事务要等游标滑完，否则点了毫无反馈 */
  const [pending, setPending] = useState<Theme | null>(null)
  /** 事务序号：连点时作废前一个待提交事务，避免过期档位把最后一次选择盖掉 */
  const seq = useRef(0)
  /** 上一次等待的收摊函数（连点或卸载时先解掉） */
  const cancel = useRef<(() => void) | null>(null)
  const shown = pending ?? theme

  useEffect(() => () => cancel.current?.(), [])

  /** 解析某档的实际明暗（system 由系统偏好解析，其余即本值） @param value 明暗档 */
  const resolve = (value: Theme) => (value === "system" ? systemTheme : value)

  /** 动画起点：控件回传被点选项的中心；缺省时落到视口中心 */
  const originOf = (at?: { x: number; y: number }) =>
    at && (at.x !== 0 || at.y !== 0)
      ? at
      : { x: innerWidth / 2, y: innerHeight / 2 }

  /**
   * 切到指定明暗档
   * @param next 目标档
   * @param at 动画起点（选项切换控件回传的被点选项中心）
   * @param settleMs 游标滑行时长上限（传控件导出的 SLIDE_MS；0＝不等滑行）
   * @param floorMs 滑行结束后还要再等多久（菜单内嵌那处传浮层关闭时长）
   */
  const switchTo = (
    next: Theme,
    at?: { x: number; y: number },
    settleMs = 0,
    floorMs = 0
  ) => {
    const stamp = ++seq.current
    if (next === theme) {
      setPending(null)
      return
    }
    // 用户已明确选择：先作废尚未播放的系统抖动（包括无动画提前提交分支，避免之后再被系统过渡覆盖）
    cancelSystemTransitions()
    const previous = theme
    const { x, y } = originOf(at)
    /** 过期事务直接丢弃（已有更新的选择在排队） */
    const live = () => seq.current === stamp
    const commit = () => {
      if (!live()) return
      setTheme(next)
      setPending(null)
    }

    setPending(next)
    cancel.current?.()
    cancel.current = null

    // 生效明暗不变（如浅色下改选「跟随系统」而系统也是浅色）：没有动画可等，直接落状态
    if (resolve(next) === resolvedTheme) {
      commit()
      return
    }

    cancel.current = afterCursorSlide(settleMs, floorMs, () => {
      cancel.current = null
      if (!live()) return
      startThemeTransition({
        apply: commit,
        rollback: () => {
          if (!live()) return
          setPending(null)
          setTheme(previous)
        },
        x,
        y,
      })
    })
  }

  return { shown, switchTo }
}
