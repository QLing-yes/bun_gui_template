// 图标统一入口（唯一调用点）：AppIcon 按 AGENTS 图标阶梯自动路由 ① react-useanimations（@useanimations 官方件）
// → ② lucide-react 静态；上级有对应就用上级，缺才降级
// 摇树/按需：主模块只静态引 lucide-react 逐图标（兼作懒加载回落）；lottie 分支懒加载独立 chunk，
// Suspense fallback 回落同名静态图标（无布局空窗）；登记表与默认值模块级单例一次初始化
// 尺寸单源 size 参数：各级图标组件缺省一律 ICON_PX=24（对齐 lucide-react 默认），chrome 调用点显式传 16/14；
// className 只接颜色/布局类，改尺寸走 size

import { lazy, Suspense } from "react"
import type { CSSProperties } from "react"
import type { LucideIcon } from "lucide-react"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BotIcon,
  ChevronRightIcon,
  CircleHelpIcon,
  ContrastIcon,
  CopyIcon,
  FileQuestionMarkIcon,
  FlaskConicalIcon,
  FolderIcon,
  FolderOpenIcon,
  KeyRoundIcon,
  KeyboardIcon,
  LoaderCircleIcon,
  LockIcon,
  LogInIcon,
  LogOutIcon,
  MinusIcon,
  MonitorIcon,
  MoonIcon,
  MoreHorizontalIcon,
  PaletteIcon,
  PanelBottomCloseIcon,
  PanelBottomOpenIcon,
  PanelLeftCloseIcon,
  PanelLeftIcon,
  PanelLeftInactiveIcon,
  PanelLeftOpenIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  PencilIcon,
  PinIcon,
  PinOffIcon,
  PlusIcon,
  RotateCcwIcon,
  SendIcon,
  SettingsIcon,
  SquareIcon,
  SquarePenIcon,
  SunIcon,
  Trash2Icon,
  UserIcon,
  WorkflowIcon,
  XIcon,
} from "lucide-react"
import type { Interaction } from "@/components/use-animation"
import type { AnimationIconName } from "@/components/animation-icon"
import { cn } from "cn"

export type { AnimationIconName } from "@/components/animation-icon"

/** 图标默认边长（px）单源：AppIcon/AnimationIcon 及 ①② 级分支实现的 size 缺省全部引用本值（对齐 lucide-react 默认 24）；chrome 调用点显式传 16/14 */
export const ICON_PX = 24
/** 图标基类：仅防缩，尺寸走 size 参数 */
const ICON_CLASS = "shrink-0"

/** 静态登记表（③ 级 + 懒加载回落）：只登记项目在用图标（摇树） */
const ICONS = {
  arrowLeft: ArrowLeftIcon,
  arrowRight: ArrowRightIcon,
  bot: BotIcon,
  chevronRight: ChevronRightIcon,
  contrast: ContrastIcon,
  copy: CopyIcon,
  edit: SquarePenIcon,
  edit2: PencilIcon,
  fileQuestionMark: FileQuestionMarkIcon,
  flaskConical: FlaskConicalIcon,
  folder: FolderIcon,
  folderOpen: FolderOpenIcon,
  help: CircleHelpIcon,
  key: KeyRoundIcon,
  keyboard: KeyboardIcon,
  loadingV2: LoaderCircleIcon,
  lock: LockIcon,
  logIn: LogInIcon,
  logOut: LogOutIcon,
  minus: MinusIcon,
  monitor: MonitorIcon,
  moon: MoonIcon,
  moreHorizontal: MoreHorizontalIcon,
  palette: PaletteIcon,
  panelBottomClose: PanelBottomCloseIcon,
  panelBottomOpen: PanelBottomOpenIcon,
  panelLeft: PanelLeftIcon,
  panelLeftClose: PanelLeftCloseIcon,
  panelLeftInactive: PanelLeftInactiveIcon,
  panelLeftOpen: PanelLeftOpenIcon,
  panelRightClose: PanelRightCloseIcon,
  panelRightOpen: PanelRightOpenIcon,
  pin: PinIcon,
  pinOff: PinOffIcon,
  plus: PlusIcon,
  rotateCcw: RotateCcwIcon,
  send: SendIcon,
  settings: SettingsIcon,
  sidebar: PanelLeftIcon,
  square: SquareIcon,
  sun: SunIcon,
  trash: Trash2Icon,
  user: UserIcon,
  workflow: WorkflowIcon,
  x: XIcon,
} satisfies Record<string, LucideIcon>

/** AppIcon 可用图标键 */
export type AppIconName = keyof typeof ICONS

/** ① 级键单源（animation-icon 登记表经 satisfies 同源约束）：动效只在「新建项目/明暗三档/加载」五件上，其余一律 ② 级静态 */
export type UaName = "edit" | "sun" | "moon" | "monitor" | "loadingV2"

/** ① 级集合：react-useanimations 在用动效件 */
const UA_SET = new Set<AppIconName>([
  "edit",
  "sun",
  "moon",
  "monitor",
  "loadingV2",
] satisfies UaName[])

/** 全部登记键（审计页用） */
export const APP_ICON_NAMES = Object.keys(ICONS) as AppIconName[]

/** 图标 tier（审计页展示）：1=useanimations 动效 2=lucide-react 静态 @param name 登记表键 @returns tier */
export function iconTierOf(name: AppIconName): 1 | 2 {
  if (UA_SET.has(name)) return 1
  return 2
}

// 空闲预取动画分支：消首次悬停「静态→动画」切换闪；不阻塞首屏（仍独立 chunk，空闲才拉）
if (typeof window !== "undefined" && "requestIdleCallback" in window) {
  window.requestIdleCallback(() => {
    void import("./animation-icon")
  })
}

/** lottie 分支懒加载：命中 ① 级才拉 chunk */
const LazyAnimationIcon = lazy(() =>
  import("./animation-icon").then((m) => ({ default: m.AnimationIconImpl }))
)

/** 统一图标（阶梯自动路由） @param name 登记表键 @param size 边长 px @param className 颜色/布局类 @param style 内联样式（数据驱动染色等） @param data-icon Button 内图标间距标记 @param interaction ① 级播放模式（缺省 hover-replay，加载态传 loop） @param active ① 级 click-toggle 受控态 @param loop ① 级循环 @param speed ① 级倍速 @param strokeWidth 静态版描边宽 */
export function AppIcon({
  name,
  size = ICON_PX,
  className,
  style,
  "data-icon": dataIcon,
  "aria-label": ariaLabel,
  interaction,
  active,
  loop,
  speed,
  strokeWidth,
}: {
  name: AppIconName
  size?: number
  className?: string
  style?: CSSProperties
  "data-icon"?: "inline-start" | "inline-end"
  "aria-label"?: string
  interaction?: Interaction
  active?: boolean
  loop?: boolean | number
  speed?: number
  strokeWidth?: number
}) {
  const Cmp = ICONS[name]
  // aspect-square 锁正方盒：任何父级拉伸/单维覆写下图标不变形
  const cls = cn(ICON_CLASS, "aspect-square", className)
  const staticNode = (
    <Cmp
      size={size}
      strokeWidth={strokeWidth}
      className={cls}
      style={style}
      data-icon={dataIcon}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    />
  )
  // 集合与各级登记表同源约束，此处断言安全
  if (UA_SET.has(name)) {
    return (
      <Suspense fallback={staticNode}>
        <LazyAnimationIcon
          name={name as AnimationIconName}
          interaction={interaction ?? "hover-replay"}
          active={active}
          loop={loop}
          speed={speed}
          size={size}
          className={cls}
          style={style}
          data-icon={dataIcon}
          aria-label={ariaLabel}
        />
      </Suspense>
    )
  }
  return staticNode
}

/** Lottie 交互图标显式入口（需图标自带交互默认时用） @param name 登记表键 @param interaction 播放模式（缺省用图标自带） @param active click-toggle 受控态 @param size 边长 px @param speed 倍速 @param loop 循环 @param className 颜色/布局类 @param strokeColor 描边色（默认跟随文本） @param fillColor 填充色 */
export function AnimationIcon({
  name,
  interaction,
  active,
  size = ICON_PX,
  speed,
  loop,
  className,
  strokeColor = "currentColor",
  fillColor,
}: {
  name: AnimationIconName
  interaction?: Interaction
  active?: boolean
  size?: number
  speed?: number
  loop?: boolean | number
  className?: string
  strokeColor?: string
  fillColor?: string
}) {
  return (
    <Suspense fallback={<AppIcon name={name} size={size} className={className} />}>
      <LazyAnimationIcon
        name={name}
        interaction={interaction}
        active={active}
        size={size}
        speed={speed}
        loop={loop}
        strokeColor={strokeColor}
        fillColor={fillColor}
        className={cn(ICON_CLASS, className)}
      />
    </Suspense>
  )
}