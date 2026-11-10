// AnimationIcon 实现（懒加载 chunk）：useanimations 官方 registry 件登记表（① 级），首次命中才加载（lottie 运行时随之进独立 chunk）
// 加载期间由 icons.tsx 的 Suspense fallback 回落同名静态图标，无布局空窗

import type { ComponentType, CSSProperties } from "react"
import { cn } from "cn"
import { AnimatedEdit } from "@/components/animations/edit"
import { AnimatedLoadingV2 } from "@/components/animations/loading-v2"
import { AnimatedMonitor } from "@/components/animations/monitor"
import { AnimatedMoon } from "@/components/animations/moon"
import { AnimatedSun } from "@/components/animations/sun"
import type { Interaction, UseAnimationProps } from "@/components/use-animation"
import type { UaName } from "@/components/icons"
import { ICON_PX } from "@/components/icons"

/** useanimations 官方件形状（player props 去掉 animationData） */
type UaIcon = ComponentType<Omit<UseAnimationProps, "animationData">>

/** 逐图标光学归一系数：Lottie comp 32 内嵌图形占盒比不一，系数=目标占盒/实测占盒（clamp 0.7–1.7）对齐 lucide 主流占盒 0.75。
 *  实测口径=bun 脚本解析 animationData：顶点经各级分组 tr 变换映射到 comp 空间后取并集包围盒（只计静止/落位帧，
 *  剔除飞入途中与越界瞬态位置）；正圆主导件按 lucide 自身口径上浮（圆盘件 ~0.83，方框件 3..21=0.75）；
 *  动画位姿测不到者（loadingV2）回落 1.33；微调入口：dev 审计页 #/dev/icons 目检后改本表 */
const UA_OPTICAL_SCALE: Record<UaName, number> = {
  edit: 1.2,
  sun: 1.45,
  moon: 1.4,
  monitor: 1.2,
  loadingV2: 1.33,
}

/** 官方件登记表：与 icons.tsx 的 UaName 同源；新增先 shadcn add @useanimations/<name> 再补登记 */
const UA_ICONS = {
  edit: AnimatedEdit,
  sun: AnimatedSun,
  moon: AnimatedMoon,
  monitor: AnimatedMonitor,
  loadingV2: AnimatedLoadingV2,
} satisfies Record<UaName, UaIcon>

/** ① 级可用键（单源在 icons.tsx） */
export type AnimationIconName = UaName

/** Lottie 交互图标实现 @param name 登记表键 @param interaction 播放模式 @param active click-toggle 受控态 @param size 边长 px @param speed 倍速 @param loop 循环 @param className 已合并基类的颜色/布局类 @param style 内联样式 @param data-icon Button 间距标记 @param aria-label 无障碍名 @param strokeColor 描边色 @param fillColor 填充色 */
export function AnimationIconImpl({
  name,
  interaction,
  active,
  size = ICON_PX,
  speed,
  loop,
  className,
  style,
  "data-icon": dataIcon,
  "aria-label": ariaLabel,
  strokeColor,
  fillColor,
}: {
  name: AnimationIconName
  interaction?: Interaction
  active?: boolean
  size?: number
  speed?: number
  loop?: boolean | number
  className?: string
  style?: CSSProperties
  "data-icon"?: "inline-start" | "inline-end"
  "aria-label"?: string
  strokeColor?: string
  fillColor?: string
}) {
  const Cmp = UA_ICONS[name]
  const factor = UA_OPTICAL_SCALE[name]
  // 容器盒=内层盒=size（等大）、flex 居中；CSS 独立 scale 属性做逐图标光学归一（与 rotate 正交复合、单值统一缩放不变形）；
  // stroke 随 scale 放大/缩小会破坏与 lucide 2/24 的描边 parity：--icon-stroke 反补（comp 单位 2×32/24÷factor）
  return (
    <span
      data-slot="ua-icon"
      className={cn(
        "inline-flex aspect-square shrink-0 items-center justify-center [&_svg]:aspect-square [&_svg]:[stroke-width:var(--icon-stroke)]",
        className
      )}
      style={
        {
          width: size,
          height: size,
          scale: factor,
          "--icon-stroke": (2.6667 / factor).toFixed(3),
          ...style,
        } as CSSProperties
      }
      data-icon={dataIcon}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    >
      <Cmp
        interaction={interaction}
        active={active}
        size={size}
        speed={speed}
        loop={loop}
        strokeColor={strokeColor}
        fillColor={fillColor}
        className="flex aspect-square items-center justify-center"
      />
    </span>
  )
}