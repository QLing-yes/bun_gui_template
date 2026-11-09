// 内容区分栏布局：挂在页面轨道外层（换页平移仍只发生在左上主内容块 page-track 内）
// 拆分顺序：外层纵向「上主内容 | 下底栏（横跨整条内容区）」，上格内部再横向「左页面 | 右栏」
// ——右下角归属底栏，不存在第三块独立区域，也不出现三方拼缝
// 组件与 API 形态沿用 shadcn resizable 官方示例（百分比字符串尺寸 + withHandle 把手），但不照抄其嵌套顺序
// 拖动期几何由库直改、零 React 状态更新；尺寸与两条收起态合存 lib/storage 单键（不用库自带 autoSaveId）
// 收起态单源在 store/content-split（标题栏按钮/快捷键共用），本文件只持有尺寸并负责落盘与驱动面板
// 启动闸门放行后同步取真值，各面板 defaultSize 首帧即为用户记录；内容区宽/高低于固定阈值自动收起，不压扁主内容

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import type { ReactNode } from "react"

import { PanelBottomCloseIcon, PanelRightCloseIcon } from "lucide-react"
import { usePanelRef } from "react-resizable-panels"
import type {
  Layout,
  LayoutChangedMeta,
  PanelImperativeHandle,
} from "react-resizable-panels"

import { IconAction } from "@/components/layout/icon-action"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { prefersReducedMotion } from "@/lib/motion"
import { readTextSync, STORAGE_KEYS, writeText } from "@/lib/storage"
import {
  isThemeTransitioning,
  onThemeTransitionStart,
} from "@/lib/theme-transition"
import { useContentSplitStore } from "@/store/content-split"

/** 右栏（横向内层）最小宽度（px） */
const RIGHT_MIN_W = 200

/** 底栏最小高度（px） */
const BOTTOM_MIN_H = 160

/** 主内容最小宽度（px） */
const MAIN_MIN_W = 560

/** 主内容最小高度（px） */
const MAIN_MIN_H = 360

/** 内容区宽度低于此值自动收起右栏（固定常量＝主内容最小宽 + 右栏最小宽） */
const AUTO_COLLAPSE_W = MAIN_MIN_W + RIGHT_MIN_W

/** 内容区高度低于此值自动收起底栏（固定常量＝主内容最小高 + 底栏最小高） */
const AUTO_COLLAPSE_H = MAIN_MIN_H + BOTTOM_MIN_H

/** 右栏默认占比（%） */
const RIGHT_DEFAULT_PCT = 24

/** 底栏默认占比（%） */
const BOTTOM_DEFAULT_PCT = 25

/** 存储比例合法区间（%）：只挡脏值，实际上下限由面板像素约束兜底 */
const PCT_MIN = 10

/** 存储比例上限（%） */
const PCT_MAX = 90

/** 拖动收起阈值：设为超过整个分组的距离＝拖动只停在最小尺寸、绝不吸附收起（收起只能点标题栏按钮） */
const DRAG_COLLAPSE_THRESHOLD = "100%"

/** 过渡收尾余量（ms）：定时器只作保险丝，比过渡时长略晚摘除 data-animating，避免提前截断最后一帧 */
const ANIM_SLOP_MS = 40

/** 外层面板 id：上半部（主内容 + 右栏） */
const PANEL_MAIN = "content-split-main"

/** 外层面板 id：底栏（横跨整条内容区） */
const PANEL_BOTTOM = "content-split-bottom"

/** 内层左面板 id：主内容（页面轨道） */
const PANEL_PAGE = "content-split-page"

/** 内层右面板 id：右侧栏 */
const PANEL_RIGHT = "content-split-right"

/** 分栏尺寸（%）：本层唯一持有的布局数值（收起态在 store，不在此） */
type SplitSize = {
  /** 右栏宽度占比（%） */
  right: number
  /** 底栏高度占比（%） */
  bottom: number
}

/** 持久化记录：一个键存两条比例与两条用户收起态 */
type ContentSplit = SplitSize & {
  /** 右栏是否由用户收起 */
  rightCollapsed: boolean
  /** 底栏是否由用户收起 */
  bottomCollapsed: boolean
}

/** 自动收起状态（内容区尺寸不足时派生，不持久化） */
type AutoCollapsed = {
  /** 右栏是否因空间不足自动收起 */
  right: boolean
  /** 底栏是否因空间不足自动收起 */
  bottom: boolean
}

/** 过渡方向：open=几何先走、内容后淡入；close=内容先淡出、几何后收（由 CSS 错峰实现） */
type SplitAnimDir = "open" | "close"

/** 默认布局：右栏约 1/4 宽、底栏约 1/4 高 */
const DEFAULT_SPLIT: ContentSplit = {
  right: RIGHT_DEFAULT_PCT,
  bottom: BOTTOM_DEFAULT_PCT,
  rightCollapsed: false,
  bottomCollapsed: false,
}

/** 比例收敛到合法区间 @param value 原始值 @returns 百分比 */
function clampPct(value: number): number {
  return Math.min(PCT_MAX, Math.max(PCT_MIN, value))
}

/** 解析存储记录 @param raw 原文 @returns 记录；缺省或脏值返回 null */
function parseSplit(raw: string | null): ContentSplit | null {
  if (raw === null) return null
  try {
    const value = JSON.parse(raw) as Partial<ContentSplit> | null
    const right = Number(value?.right)
    const bottom = Number(value?.bottom)
    if (!Number.isFinite(right) || !Number.isFinite(bottom)) return null
    return {
      right: clampPct(right),
      bottom: clampPct(bottom),
      rightCollapsed: value?.rightCollapsed === true,
      bottomCollapsed: value?.bottomCollapsed === true,
    }
  } catch {
    return null
  }
}

/** 依据内容区尺寸给出自动收起状态 @param width 内容区宽 @param height 内容区高 @returns 自动收起状态 */
function autoStateOf(width: number, height: number): AutoCollapsed {
  return {
    right: width < AUTO_COLLAPSE_W,
    bottom: height < AUTO_COLLAPSE_H,
  }
}

/** 读取动效单源时长（ms）：缺失或非法时返回 0（视为不播） @param el 取值的元素 @param token 自定义属性名 @returns 毫秒 */
function animDurationMs(el: HTMLElement, token: string): number {
  const raw = getComputedStyle(el).getPropertyValue(token).trim()
  const value = Number.parseFloat(raw)
  if (!Number.isFinite(value)) return 0
  return raw.endsWith("ms") ? value : raw.endsWith("s") ? value * 1000 : value
}

/** 同步面板到目标收起态；库内已是该态时为空操作 @param panel 面板句柄 @param collapsed 是否收起 */
function applyCollapse(
  panel: PanelImperativeHandle | null,
  collapsed: boolean
): void {
  if (!panel) return
  if (collapsed) panel.collapse()
  else panel.expand()
}

/** 面板占位内容：标题行右侧关闭按钮 + 说明（展开入口仍只在标题栏/热键）
 * @param props 标题、说明、所属面板、是否已收起、关闭图标、关闭按钮文案与关闭动作 */
function PanelPlaceholder({
  title,
  description,
  side,
  hidden,
  closeIcon,
  closeLabel,
  onClose,
}: {
  /** 面板标题 */
  title: string
  /** 面板说明 */
  description: string
  /** 所属面板：内容淡出目标由根上对应的 data-off-* 驱动 */
  side: "right" | "bottom"
  /** 是否已收起（收起后整块退出命中与朗读） */
  hidden: boolean
  /** 关闭图标（与标题栏该面板开关的「已展开」图标同一枚） */
  closeIcon: typeof PanelRightCloseIcon
  /** 关闭按钮的无障碍名称 */
  closeLabel: string
  /** 关闭（收起）动作 */
  onClose: () => void
}) {
  const CloseIcon = closeIcon
  return (
    <div
      data-slot="content-split-panel-body"
      data-side={side}
      className="flex h-full min-h-0 min-w-0 flex-col gap-2 overflow-hidden p-4"
      inert={hidden}
      aria-hidden={hidden || undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="min-w-0 text-sm font-medium">{title}</h2>
        <IconAction
          hint={closeLabel}
          variant="ghost"
          button={{ onClick: onClose, "aria-label": closeLabel }}
        >
          <CloseIcon className="size-4 shrink-0" />
        </IconAction>
      </div>
      <p className="min-w-0 text-xs leading-relaxed break-words text-muted-foreground">
        {description}
      </p>
    </div>
  )
}

/**
 * 内容区分栏布局 @param children 主内容（页面轨道）
 * @remarks 换页平移由 children 自己完成，本组件只分配空间
 */
export function ContentLayout({ children }: { children: ReactNode }) {
  /** 首次恢复的完整记录（之后拖动不改它，各面板 defaultSize 只用它算一次）
   * 启动闸门放行后缓存已装载，这里同步取真值，首帧即为用户记录，不先按默认值再跳 */
  const [initial] = useState<ContentSplit>(
    () => parseSplit(readTextSync(STORAGE_KEYS.contentSplit)) ?? DEFAULT_SPLIT
  )
  /** 当前分栏尺寸（收起态不在本层；DOM 几何由库直改，无需 React 状态驱动重渲染） */
  const sizeRef = useRef<SplitSize>({ right: initial.right, bottom: initial.bottom })
  /** 最近一次已落盘记录（同值不重复提交） */
  const lastRecord = useRef(JSON.stringify(initial))
  /** 内容区根：自动收起判据与尺寸日志 */
  const rootRef = useRef<HTMLDivElement>(null)
  /** 右栏/底栏面板句柄（收起与展开的 imperative 入口） */
  const rightRef = usePanelRef()
  const bottomRef = usePanelRef()
  /** 收起/展开过渡计时器（唯一一条，到点摘除 data-animating） */
  const animTimer = useRef<number | null>(null)
  /** 过渡时长缓存（只在第一次切换时读一次单源，避免每次切换都强制样式重算） */
  const animMsRef = useRef(0)
  /** 上次用户收起态（只有它的变化才播过渡） */
  const prevUser = useRef({
    right: initial.rightCollapsed,
    bottom: initial.bottomCollapsed,
  })
  /** 上次自动收起态（窗口尺寸派生，变化一律即时到位） */
  const prevAuto = useRef({ right: false, bottom: false })
  /** 首次布局效应只做同步：启动恢复不播过渡 */
  const firstPass = useRef(true)

  /** 用户收起态（单源：标题栏按钮/快捷键改，本组件订阅后驱动面板） */
  const rightCollapsed = useContentSplitStore((s) => s.rightCollapsed)
  const bottomCollapsed = useContentSplitStore((s) => s.bottomCollapsed)
  /** 自动收起标记（窄屏派生，不落盘） */
  const autoRight = useContentSplitStore((s) => s.autoRight)
  const autoBottom = useContentSplitStore((s) => s.autoBottom)
  const hydrate = useContentSplitStore((s) => s.hydrate)
  const setAuto = useContentSplitStore((s) => s.setAuto)
  const toggle = useContentSplitStore((s) => s.toggle)

  /** 中止进行中的过渡：摘除 data-animating，CSS 过渡消失后几何立即落到库目标值
   * @param reason 中止原因（DEV 日志） @returns 是否有过渡被中止 */
  const stopAnim = useCallback((reason: string): boolean => {
    const el = rootRef.current
    const running = el?.dataset.animating !== undefined
    if (animTimer.current !== null) {
      window.clearTimeout(animTimer.current)
      animTimer.current = null
    }
    if (!running || !el) return false
    delete el.dataset.animating
    if (import.meta.env.DEV) {
      console.debug("[content-split] anim-end", { reason })
    }
    return true
  }, [])

  /** 启动/延续收起展开过渡（再次调用＝改写目标值并重置计时，CSS 从当前值自然折返）
   * @param reason 触发原因（DEV 日志）
   * @param dir 方向：open=几何先走、内容后淡入；close=内容先淡出、几何后收
   * @remarks 必须先挂 data-animating 再写入内容目标与面板目标：transition 规则要早于两者的样式变化生效 */
  const startAnim = useCallback(
    (reason: string, dir: SplitAnimDir) => {
      const el = rootRef.current
      if (!el) return
      // 主题圆形揭示期间活文档被快照替换，过渡会冻结在快照里：直接到位，揭示结束呈现最终态
      if (isThemeTransitioning()) {
        stopAnim("theme-transition")
        if (import.meta.env.DEV) {
          console.debug("[content-split] anim-skip", {
            reason: "theme-transition",
          })
        }
        return
      }
      const retarget = el.dataset.animating !== undefined
      el.dataset.animating = dir
      let ms = animMsRef.current
      if (ms <= 0) {
        ms = animDurationMs(el, "--push-duration-fast")
        animMsRef.current = ms
      }
      if (ms <= 0) {
        delete el.dataset.animating
        if (import.meta.env.DEV) {
          console.debug("[content-split] anim-skip", { reason: "no-duration" })
        }
        return
      }
      if (animTimer.current !== null) window.clearTimeout(animTimer.current)
      // 方向切换后最长链仍是几何（open 全程 / close 延迟 0.3 档 + 0.7 档），保险丝按时长单源兜底
      animTimer.current = window.setTimeout(() => {
        animTimer.current = null
        delete el.dataset.animating
        if (import.meta.env.DEV) {
          console.debug("[content-split] anim-end", { reason })
        }
      }, ms + ANIM_SLOP_MS)
      if (import.meta.env.DEV) {
        console.debug(
          retarget
            ? "[content-split] anim-retarget"
            : "[content-split] anim-start",
          { reason, dir, ms }
        )
      }
    },
    [stopAnim]
  )

  /** 跳过过渡并即时到位 @param reason 跳过原因（DEV 日志） */
  const skipAnim = useCallback(
    (reason: string) => {
      const cancelled = stopAnim(reason)
      if (import.meta.env.DEV) {
        console.debug("[content-split] anim-skip", { reason, cancelled })
      }
    },
    [stopAnim]
  )

  /** 落盘一条完整记录（尺寸 + 当前收起态），同值跳过 @param next 尺寸 @param reason 触发原因（DEV 日志） */
  const persist = useCallback((next: SplitSize, reason: string) => {
    const { rightCollapsed: rightOff, bottomCollapsed: bottomOff } =
      useContentSplitStore.getState()
    const record: ContentSplit = {
      ...next,
      rightCollapsed: rightOff,
      bottomCollapsed: bottomOff,
    }
    const raw = JSON.stringify(record)
    if (raw === lastRecord.current) return
    lastRecord.current = raw
    void writeText(STORAGE_KEYS.contentSplit, raw)
    if (import.meta.env.DEV) {
      console.debug("[content-split] commit", { reason, ...record })
    }
  }, [])

  /** 提交尺寸：写内存镜像并落盘（几何已由库直改，不触发重渲染） @param next 新尺寸 @param reason 触发原因 */
  const commitSize = useCallback(
    (next: SplitSize, reason: string) => {
      sizeRef.current = next
      persist(next, reason)
    },
    [persist]
  )

  /** 外层（上半部/底栏）松手提交 @param layout 分组布局 @param meta 变更来源 */
  const onOuterLayoutChanged = useCallback(
    (layout: Layout, meta: LayoutChangedMeta) => {
      if (!meta.isUserInteraction) return
      // 用户拖动/键盘调整一律即时跟手：进行中的过渡先中止
      stopAnim("drag")
      const bottom = layout[PANEL_BOTTOM]
      if (bottom === undefined) return
      commitSize({ ...sizeRef.current, bottom: clampPct(bottom) }, "drag-bottom")
    },
    [commitSize, stopAnim]
  )

  /** 内层（主内容/右栏）松手提交 @param layout 分组布局 @param meta 变更来源 */
  const onInnerLayoutChanged = useCallback(
    (layout: Layout, meta: LayoutChangedMeta) => {
      if (!meta.isUserInteraction) return
      // 用户拖动/键盘调整一律即时跟手：进行中的过渡先中止
      stopAnim("drag")
      const right = layout[PANEL_RIGHT]
      if (right === undefined) return
      commitSize({ ...sizeRef.current, right: clampPct(right) }, "drag-right")
    },
    [commitSize, stopAnim]
  )

  /** 收起态水合（只跑一次）：把持久化记录灌入共享 store，标题栏按钮随即成为真值 */
  useLayoutEffect(() => {
    hydrate(initial.rightCollapsed, initial.bottomCollapsed)
    if (import.meta.env.DEV) {
      console.debug("[content-split] restore", {
        ...initial,
        raw: readTextSync(STORAGE_KEYS.contentSplit),
      })
    }
  }, [hydrate, initial])

  // 收起态 → 面板：绘制前按实际内容区尺寸预判并直接收起，保证首帧不闪展开态
  // 预判不写 store（状态侧由观察器以当前值为基线补上，否则跳过 setAuto 会丢掉按钮受限态）
  // 过渡只给用户切换播：自动收起/减少动效/主题揭示一律即时到位（见各分支）
  useLayoutEffect(() => {
    const el = rootRef.current
    const state = useContentSplitStore.getState()
    const userNow = {
      right: state.rightCollapsed,
      bottom: state.bottomCollapsed,
    }
    const autoNow = { right: state.autoRight, bottom: state.autoBottom }
    const rightToggled = userNow.right !== prevUser.current.right
    const bottomToggled = userNow.bottom !== prevUser.current.bottom
    const userChanged = rightToggled || bottomToggled
    const autoChanged =
      autoNow.right !== prevAuto.current.right ||
      autoNow.bottom !== prevAuto.current.bottom
    prevUser.current = userNow
    // 首帧按实测尺寸预判（观察器尚未上报），此后一律以 store 为准
    let autoEff = autoNow
    if (firstPass.current) {
      firstPass.current = false
      autoEff = el ? autoStateOf(el.clientWidth, el.clientHeight) : autoNow
      prevAuto.current = autoEff
    } else {
      prevAuto.current = autoNow
      if (autoChanged) {
        // 窗口拖动跨阈值时只做几何修正；连续动画会拖慢拖动且无反馈价值
        skipAnim("auto-collapse")
      } else if (userChanged) {
        if (prefersReducedMotion()) {
          skipAnim("reduced-motion")
        } else {
          // 任一侧变为收起＝close，否则 open；两键同时反向时按 close 处理（仅影响错峰顺序）
          const closing =
            (rightToggled && userNow.right) ||
            (bottomToggled && userNow.bottom)
          startAnim("toggle", closing ? "close" : "open")
        }
      }
    }
    const offRight = userNow.right || autoEff.right
    const offBottom = userNow.bottom || autoEff.bottom
    // 内容可见性写在根上、不交给 React 提交：保证它与 data-animating 同一批生效；
    // 否则别的 layout effect 在两者之间强制样式重算，会把淡出/淡入压成瞬切
    if (el) {
      if (offRight) el.dataset.offRight = "true"
      else delete el.dataset.offRight
      if (offBottom) el.dataset.offBottom = "true"
      else delete el.dataset.offBottom
    }
    applyCollapse(rightRef.current, offRight)
    applyCollapse(bottomRef.current, offBottom)
  }, [
    rightCollapsed,
    bottomCollapsed,
    autoRight,
    autoBottom,
    rightRef,
    bottomRef,
    skipAnim,
    startAnim,
  ])

  // 主题圆形揭示开始 → 立即中止进行中的过渡：VT 期间活文档被快照替换，
  // 冻结在快照里再续播会跳一截，直接到位后由新快照呈现最终态
  useEffect(
    () => onThemeTransitionStart(() => stopAnim("theme-transition")),
    [stopAnim]
  )

  // 预热过渡时长：挂载后读一次单源并缓存，切换当帧就不再为读时长强制样式重算（读写分开）
  useEffect(() => {
    const el = rootRef.current
    if (el) animMsRef.current = animDurationMs(el, "--push-duration-fast")
  }, [])

  // 卸载清理：过渡计时器不跨实例残留
  useEffect(
    () => () => {
      if (animTimer.current !== null) window.clearTimeout(animTimer.current)
    },
    []
  )

  // 收起态变化 → 落盘：订阅 store（水合已在此前完成，不会把旧值写回同一键）
  useEffect(
    () =>
      useContentSplitStore.subscribe((state, prev) => {
        if (
          state.rightCollapsed === prev.rightCollapsed &&
          state.bottomCollapsed === prev.bottomCollapsed
        ) {
          return
        }
        persist(sizeRef.current, "toggle")
      }),
    [persist]
  )

  // 内容区尺寸 → 自动收起：只切布尔，不随像素连续更新；窗口恢复即按用户设置还原
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      const next = autoStateOf(el.clientWidth, el.clientHeight)
      const prev = useContentSplitStore.getState()
      if (!setAuto(next.right, next.bottom)) return
      if (!import.meta.env.DEV) return
      if (prev.autoRight !== next.right) {
        console.debug(
          next.right
            ? "[content-split] auto-collapse"
            : "[content-split] auto-expand",
          { side: "right", width: el.clientWidth, threshold: AUTO_COLLAPSE_W }
        )
      }
      if (prev.autoBottom !== next.bottom) {
        console.debug(
          next.bottom
            ? "[content-split] auto-collapse"
            : "[content-split] auto-expand",
          { side: "bottom", height: el.clientHeight, threshold: AUTO_COLLAPSE_H }
        )
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [setAuto])

  /** 拖动开始（DEV 日志；只记按下，不逐帧刷屏） */
  const logDragStart = useCallback(() => {
    // 按住分割线的当帧就中止过渡，拖动从当前视觉位置起跟手（不等第一次 onLayoutChanged）
    stopAnim("drag")
    if (import.meta.env.DEV) console.debug("[content-split] drag-start")
  }, [stopAnim])

  /** 右栏生效收起态（用户收起或空间不足） */
  const rightOff = rightCollapsed || autoRight
  /** 底栏生效收起态（用户收起或空间不足） */
  const bottomOff = bottomCollapsed || autoBottom

  /** 面板标题区关闭按钮：与标题栏/热键共用同一 store（source 仅用于 DEV 日志） */
  const closeRight = useCallback(() => toggle("right", "panel"), [toggle])
  const closeBottom = useCallback(() => toggle("bottom", "panel"), [toggle])

  return (
    <div
      ref={rootRef}
      data-slot="content-split"
      className="relative flex min-h-0 flex-1 flex-col"
    >
      {/* 外层纵向：上半部（主内容 + 右栏）| 底栏（横跨整条内容区底部） */}
      <ResizablePanelGroup
        orientation="vertical"
        onLayoutChanged={onOuterLayoutChanged}
        className="min-h-0"
      >
        <ResizablePanel
          id={PANEL_MAIN}
          data-split-anim
          defaultSize={`${100 - initial.bottom}%`}
          minSize={`${MAIN_MIN_H}px`}
          className="min-h-0 min-w-0"
        >
          {/* 上半部横向：主内容（页面轨道） | 右栏 */}
          <ResizablePanelGroup
            orientation="horizontal"
            onLayoutChanged={onInnerLayoutChanged}
            className="min-h-0 min-w-0"
          >
            <ResizablePanel
              id={PANEL_PAGE}
              data-split-anim
              defaultSize={`${100 - initial.right}%`}
              minSize={`${MAIN_MIN_W}px`}
              className="flex min-h-0 min-w-0 flex-col"
            >
              {children}
            </ResizablePanel>
            <ResizableHandle
              withHandle
              className="cursor-col-resize border-0 bg-transparent"
              onPointerDown={logDragStart}
            />
            <ResizablePanel
              id={PANEL_RIGHT}
              data-split-anim
              defaultSize={`${initial.right}%`}
              collapsible
              collapsedThreshold={DRAG_COLLAPSE_THRESHOLD}
              minSize={`${RIGHT_MIN_W}px`}
              panelRef={rightRef}
              className="min-h-0 min-w-0"
            >
              <PanelPlaceholder
                title="右栏（占位）"
                description="这里是内容区右侧面板的占位区域，后续用于放置辅助信息或工具。拖动左侧分割线可调整宽度；标题行右侧的关闭按钮可收起，再次展开请用标题栏开关或快捷键。"
                side="right"
                hidden={rightOff}
                closeIcon={PanelRightCloseIcon}
                closeLabel="关闭右侧栏"
                onClose={closeRight}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
        <ResizableHandle
          withHandle
          className="cursor-row-resize border-0 bg-transparent"
          onPointerDown={logDragStart}
        />
        <ResizablePanel
          id={PANEL_BOTTOM}
          data-split-anim
          defaultSize={`${initial.bottom}%`}
          collapsible
          collapsedThreshold={DRAG_COLLAPSE_THRESHOLD}
          minSize={`${BOTTOM_MIN_H}px`}
          panelRef={bottomRef}
          className="min-h-0 min-w-0"
        >
          <PanelPlaceholder
            title="底栏（占位）"
            description="这里是内容区底部面板的占位区域（横跨整条内容区），后续用于放置日志、状态或操作栏。拖动上方分割线可调整高度；标题行右侧的关闭按钮可收起，再次展开请用标题栏开关或快捷键。"
            side="bottom"
            hidden={bottomOff}
            closeIcon={PanelBottomCloseIcon}
            closeLabel="关闭底栏"
            onClose={closeBottom}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
