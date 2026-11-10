// 选项切换：一行分段选项 + 一枚滑动游标标示选中（自包含：参数、几何、配色、时长、曲线都在这一个文件）
// 状态机与键盘导航走官方 ToggleGroup（单选）；选中不刷选项底色，靠游标位置表示
// 参数：options（值/名称/可选图标）、value、onChange(next, origin?)，窄位再加 size / iconOnly；轨道圆角固定 32px、不可调
// 游标拉伸：滑行仍走 transform 过渡，另用 keyframes 短时改宽度做「被拽过去」的形变（判据见 lib/motion.ts 几何动画一条）
// 峰值口径：目标项宽 + 位移一半，夹在生长侧可用空间与轨道内宽；按运动方向生长（右切左缘不动、左切负 margin-left 推左缘），中途可压过相邻项（已确认取舍）
// 纪律例外（显式）：颜色仍只引用语义令牌（类名里不写十六进制），时长与曲线用本文件常量单源，不占全局令牌；
// 全局 prefers-reduced-motion 的 transition-duration 压平带 !important，会覆盖这里的内联过渡，无需另做降级

import type { MouseEvent } from "react"

import { AppIcon } from "@/components/icons"
import type { AppIconName } from "@/components/icons"
import { useCallback, useEffect, useLayoutEffect, useRef } from "react"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { prefersReducedMotion } from "@/lib/motion"
import { cn } from "cn"

/** 一个选项 @param value 取值 @param label 名称 @param icon 可选图标 */
export type SwitchOption = {
  value: string
  label: string
  icon?: AppIconName
}

/** 圆形点击起点（供调用方做全屏动画的圆心） */
export type SwitchOrigin = { x: number; y: number }

/** 游标滑行时长（ms）：调用方要等它滑完再启动全屏动画，故对外暴露 */
export const SLIDE_MS = 300
/** 圆角形变时长（ms）：改半径时跟着收住 */
const SHAPE_MS = 250
/** 滑行缓动：先粘后窜（0.7 起手 ≈ 前段近静止），显式控制点，不用平台默认 */
const SLIDE_EASE = "cubic-bezier(0.7, 0, 0.2, 1)"
/** 形变缓动 */
const SHAPE_EASE = "cubic-bezier(0.4, 0, 0.2, 1)"

/** 轨道内衬：窄档 2px（标题栏里比 chrome 按钮还矮一档），默认档 4px */
const PAD = { sm: 2, default: 4 } as const
/** 左右内衬恒 4px：两端留余量，游标不被轨道端边切、文案不压游标 */
const PAD_X = 4
/** 轨道圆角（px，固定值不可调；游标恒半圆端，故两者不严格同心） */
const TRACK_RADIUS = 32
/** 游标圆角哨兵：足够大于任意项高，浏览器按游标半高截断，左右两端恒为半圆 */
const CURSOR_CAPSULE_RADIUS = 9999

/** 拉伸幅度口径：峰值宽 = 目标项宽 + 位移的一半，由生长侧可用空间与轨道内宽夹住（中途压过相邻项是已确认取舍） */
const STRETCH_KEYFRAMES = "option-switch-stretch"
/** 拉伸的宽度 / 左缘推移变量名（左切时用负 margin-left 让右缘不动） */
const STRETCH_VAR = {
  from: "--switch-stretch-from",
  peak: "--switch-stretch-peak",
  to: "--switch-stretch-to",
  lead: "--switch-stretch-lead",
} as const

/** 轨道过渡（这里只有圆角会变） */
const TRACK_TRANSITION = `border-radius ${SHAPE_MS}ms ${SHAPE_EASE}`
/** 游标过渡：位移与宽高走滑行，圆角走形变，首帧现身单独淡入；拉伸期间宽度由 keyframes 接管 */
const CURSOR_TRANSITION = [
  `transform ${SLIDE_MS}ms ${SLIDE_EASE}`,
  `width ${SLIDE_MS}ms ${SLIDE_EASE}`,
  `height ${SLIDE_MS}ms ${SLIDE_EASE}`,
  `border-radius ${SHAPE_MS}ms ${SHAPE_EASE}`,
  "opacity 120ms linear",
].join(", ")

/** 轨道外观：整条吃 chrome 悬停档 */
const TRACK_CLASS = "relative inline-flex w-fit max-w-fit bg-chrome-hover"
/** 游标外观：实底 + 1px 描边环（暗档才与轨道拉得开）+ 外投影做浮起；类名里的 opacity-0 是初始态，首帧量完由脚本置 1 */
const CURSOR_CLASS =
  "pointer-events-none absolute top-0 left-0 opacity-0 bg-background " +
  "shadow-[inset_0_0_0_1px_var(--edge),0_1px_2px_rgb(0_0_0/0.12)]"

type OptionSwitchProps = {
  /** 选项表：顺序即显示顺序 */
  options: readonly SwitchOption[]
  /** 当前选中值 */
  value: string
  /** 尺寸：sm 用于标题栏这类窄位，default 用于设置页 */
  size?: "sm" | "default"
  /** 只显图标（名称退到无障碍标签），窄位用 */
  iconOnly?: boolean
  /** 选中变化 @param next 目标值 @param origin 被点选项的中心坐标（未命中元素时省略） */
  onChange: (next: string, origin?: SwitchOrigin) => void
}

export function OptionSwitch({
  options,
  value,
  size = "default",
  iconOnly = false,
  onChange,
}: OptionSwitchProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const cursorRef = useRef<HTMLSpanElement>(null)
  /** 各选项节点：游标按选中项量几何（引用表比选择器稳，值里有特殊字符也不怕） */
  const itemRefs = useRef(new Map<string, HTMLButtonElement>())

  /** 首帧标记：第一次只定位不变形，之后才带过渡滑行 */
  const primed = useRef(false)
  /** 上一次的选中值：用来区分「换项滑行」与「重算几何」 */
  const lastValue = useRef(value)

  /** 把游标推到选中项上：位移与宽高直接写 DOM，不走 React 状态（省下每次重渲染）
   * 换项时先量当前宽度再写目标，随后用 keyframes 拉长；快速连点就从进行中的中途宽度续跑 */
  const updateCursor = useCallback(() => {
    const cursor = cursorRef.current
    const el = itemRefs.current.get(value)
    if (!cursor || !el) return
    const toWidth = el.offsetWidth
    const write = () => {
      cursor.style.width = `${toWidth}px`
      cursor.style.height = `${el.offsetHeight}px`
      cursor.style.transform = `translate(${el.offsetLeft}px, ${el.offsetTop}px)`
    }
    // 首帧：先现身并关过渡写几何（否则会看到从 0 宽挤出来的一下），下一帧再交还过渡
    if (!primed.current) {
      primed.current = true
      lastValue.current = value
      cursor.style.transition = "none"
      write()
      cursor.style.opacity = "1"
      requestAnimationFrame(() => {
        cursor.style.transition = CURSOR_TRANSITION
      })
      return
    }
    const prev = lastValue.current
    const slid = prev !== value
    lastValue.current = value
    // 同一项重选、或系统要求减少动效时，只定位不拉长
    if (!slid || prefersReducedMotion()) {
      write()
      return
    }
    // 峰值 = 目标项宽 + 位移一半；按运动方向生长：右切左缘不动，左切用等量负 margin-left 让右缘不动
    const fromWidth = cursor.getBoundingClientRect().width || toWidth
    const fromLeft = itemRefs.current.get(prev)?.offsetLeft ?? el.offsetLeft
    const shift = Math.abs(el.offsetLeft - fromLeft)
    const dir: "ltr" | "rtl" = el.offsetLeft >= fromLeft ? "ltr" : "rtl"
    const track = wrapRef.current
    const innerWidth = track ? track.clientWidth - PAD_X * 2 : Number.POSITIVE_INFINITY
    // 生长侧可用空间：右切看轨道盒右缘，左切看目标项左缘（原点到 0）
    const room = track
      ? dir === "ltr"
        ? track.clientWidth - el.offsetLeft - toWidth
        : el.offsetLeft
      : Number.POSITIVE_INFINITY
    const peak = Math.min(toWidth + shift / 2, toWidth + room, innerWidth)
    const lead = peak - toWidth
    write()
    cursor.style.setProperty(STRETCH_VAR.from, `${fromWidth}px`)
    cursor.style.setProperty(STRETCH_VAR.peak, `${peak}px`)
    cursor.style.setProperty(STRETCH_VAR.to, `${toWidth}px`)
    cursor.style.setProperty(STRETCH_VAR.lead, dir === "rtl" ? `${-lead}px` : "0px")
    // 重启同名动画：先撤再强制回流，否则进行中的动画不会重跑
    cursor.style.animation = "none"
    void cursor.getBoundingClientRect()
    cursor.style.animation = `${STRETCH_KEYFRAMES} ${SLIDE_MS}ms ${SLIDE_EASE} both`
    if (import.meta.env.DEV) {
      console.debug("[switch] stretch", {
        dir,
        from: fromWidth,
        to: toWidth,
        shift,
        peak,
        clamped: peak < toWidth + shift / 2,
      })
    }
  }, [value])

  // 量算在绘制前完成，游标首帧就在正确位置且不带过渡（放到 useEffect 里会先看到一次跳位）
  useLayoutEffect(updateCursor, [updateCursor, options, size, iconOnly])

  // 尺寸变化（窗口缩放、侧栏拖宽、字体缩放、长文案换档）后重新对齐游标
  // rAF 合帧：拖侧栏时 wrap 宽度逐帧变，RO 回调可能高于帧率，同一帧只量算一次
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || typeof ResizeObserver === "undefined") return
    /** 排队中的合帧句柄（0 表示当前没有待执行任务） */
    let frame = 0
    const observer = new ResizeObserver(() => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        updateCursor()
      })
    })
    observer.observe(wrap)
    return () => {
      observer.disconnect()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [updateCursor])

  // 拉伸收尾：撤掉 keyframes 与变量（含左缘的 margin-left），立刻把宽度交还 updateCursor（免得窗口缩放/拖圆角滑杆留下中途值）
  useEffect(() => {
    const cursor = cursorRef.current
    if (!cursor) return
    const settle = (event: AnimationEvent) => {
      if (event.animationName !== STRETCH_KEYFRAMES) return
      cursor.style.animation = ""
      cursor.style.marginLeft = ""
      cursor.style.removeProperty(STRETCH_VAR.from)
      cursor.style.removeProperty(STRETCH_VAR.peak)
      cursor.style.removeProperty(STRETCH_VAR.to)
      cursor.style.removeProperty(STRETCH_VAR.lead)
      updateCursor()
    }
    cursor.addEventListener("animationend", settle)
    return () => cursor.removeEventListener("animationend", settle)
  }, [updateCursor])

  /** 点击：上报目标值与该选项的中心坐标（键盘激活拿不到指针位置，元素中心同样可用） */
  const pick = (next: string, el?: HTMLButtonElement | null) => {
    const box = el?.getBoundingClientRect()
    onChange(
      next,
      box
        ? { x: box.left + box.width / 2, y: box.top + box.height / 2 }
        : undefined
    )
  }

  /**
   * 游标圆角：恒给哨兵大值，交给浏览器按自身半高截断成左右半圆端（游标高度由脚本按项高写入）
   * 轨道固定 32px，两者不严格同心，属已确认取舍
   * 形状只由「轨道 + 游标」两层表达：选项按钮必须保持透明（aria-pressed 底色被抵消），不得用 rounded-* 自绘；
   * 将来若给按钮留底色，必须写与游标同值的内联圆角，否则两层圆角不同步
   */

  return (
    <div
      data-slot="option-switch"
      ref={wrapRef}
      className={TRACK_CLASS}
      style={{
        padding: `${PAD[size]}px ${PAD_X}px`,
        borderRadius: TRACK_RADIUS,
        transition: TRACK_TRANSITION,
      }}
    >
      <ToggleGroup value={[value]} size={size} className="gap-1">
        {options.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            aria-label={option.label}
            ref={(el) => {
              if (el) itemRefs.current.set(option.value, el)
              else itemRefs.current.delete(option.value)
            }}
            className={cn(
              "relative z-10 bg-transparent text-muted-foreground",
              "hover:bg-transparent hover:text-foreground",
              "aria-pressed:bg-transparent aria-pressed:text-foreground",
              iconOnly && "px-0"
            )}
            onClick={(e: MouseEvent) =>
              pick(option.value, e.currentTarget as HTMLButtonElement)
            }
          >
            {option.icon ? (
              <AppIcon
                name={option.icon}
                size={size === "sm" ? 14 : 16}
              />
            ) : null}
            {iconOnly ? null : option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <span
        aria-hidden
        data-slot="option-switch-cursor"
        ref={cursorRef}
        className={CURSOR_CLASS}
        style={{ borderRadius: CURSOR_CAPSULE_RADIUS, transition: CURSOR_TRANSITION }}
      />
    </div>
  )
}
