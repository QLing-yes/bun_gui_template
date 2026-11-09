// 主题切换事务：class 在回调内同步落地，动画失败则回滚。不支持 View Transitions 时降级为直接切换。
// 动画本体由 index.scss 的方向规则驱动（.dark 决定收/扩），此处只写几何参数并触发过渡。
// 手动选择与系统明暗变化共用这一条链路（圆形揭示），优先级：用户手动 > 系统；
// 播放中到达的请求排队合并（系统抖动只留最后一次），同一时刻最多一条 VT，不叠加动画。
// 点击当帧的按钮反馈归调用方的乐观层：startViewTransition 的回调在后续宏任务才执行，
// 这里再加 flushSync 只会把整棵树的同步渲染压到快照捕获之前，更卡。

import { prefersReducedMotion } from "@/lib/motion"

/** 过渡优先级：user=用户手动选择；system=系统明暗变化 */
export type ThemeTransitionPriority = "user" | "system"

/** startThemeTransition 参数 */
type ThemeTransition = {
  /** 应用新主题：同步改 html class 并置 React 状态（provider 的 setTheme 满足） */
  apply: () => void
  /** 提交半途失败时回到切换前的主题（同步，不带动画） */
  rollback: () => void
  /** 动画起点 x 坐标（点击点；系统变化取视口中心） */
  x: number
  /** 动画起点 y 坐标 */
  y: number
  /** 优先级；缺省 user */
  priority?: ThemeTransitionPriority
}

/** 过渡看门狗上限：正常动画 300ms；finished 因浏览器挂起/隐藏迟迟不落时用它兜底解锁队列 */
const WATCHDOG_MS = 1000

/** 正在播放的过渡（同一时刻最多一条） */
let active: { vt: ViewTransition; priority: ThemeTransitionPriority } | null =
  null
/** 排队中的手动切换（后到覆盖先到，手动永远优先） */
let queuedUser: ThemeTransition | null = null
/** 排队中的系统切换（系统抖动只保留最后一次） */
let queuedSystem: ThemeTransition | null = null
/** 过渡开始订阅者：快照捕获前同步回调，供其它动效即时收敛（VT 期间活文档不绘制，进行中的过渡会被冻结） */
const startListeners = new Set<() => void>()

/**
 * 订阅主题过渡开始 @param listener 在快照捕获前同步调用（需在回调里把其它动效直接落到位） @returns 取消订阅
 */
export function onThemeTransitionStart(listener: () => void): () => void {
  startListeners.add(listener)
  return () => {
    startListeners.delete(listener)
  }
}

/** 是否有主题过渡正在播放或排队 @returns 有则 true（此期间其它几何/透明度过渡会被快照冻结，应直接到位） */
export function isThemeTransitioning(): boolean {
  return active !== null || queuedUser !== null || queuedSystem !== null
}

/**
 * 圆形揭示切换主题：切深色时旧快照收缩回起点，切浅色时新快照从起点扩散
 * 系统变化与手动选择走同一实现；reduced-motion / 窗口隐藏 / 无 VT 时直接切换
 * @param transition 切换事务（apply/rollback/起点坐标/优先级）
 */
export function startThemeTransition(transition: ThemeTransition): void {
  const priority = transition.priority ?? "user"
  if (priority === "system") {
    // 手动选择已排队或正在播放：系统抖动直接丢弃（手动目标优先，避免两条链路互斥打架）
    if (queuedUser || (active && active.priority === "user")) {
      debugLog("system transition dropped", { reason: "user-priority" })
      return
    }
    if (!active) {
      start(transition, priority)
      return
    }
    queuedSystem = transition
    debugLog("system transition queued", { reason: "busy" })
    return
  }

  // 手动选择：作废待播的系统抖动，并在必要时排在当前过渡之后
  queuedSystem = null
  if (!active) {
    start(transition, priority)
    return
  }
  queuedUser = transition
  debugLog("user transition queued", { reason: "busy" })
}

/** 作废尚未播放的系统过渡：用户手动选择时调用，确保手动永远压过系统抖动 */
export function cancelSystemTransitions(): void {
  if (!queuedSystem) return
  queuedSystem = null
  debugLog("system transition canceled", { reason: "user-intent" })
}

/** 真正启动一条过渡（调用方保证当前没有播放中的过渡） @param transition 事务 @param priority 优先级 */
function start(
  transition: ThemeTransition,
  priority: ThemeTransitionPriority
): void {
  // 减少动态效果：不播动画，直接切换
  if (prefersReducedMotion()) {
    commitDirect(transition, "reduced-motion")
    return
  }
  // 窗口隐藏/最小化：不补播动画，直接落状态（回到前台不会莫名播一次）
  if (document.visibilityState !== "visible") {
    commitDirect(transition, "hidden")
    return
  }
  if (!("startViewTransition" in document)) {
    commitDirect(transition, "no-vt")
    return
  }

  // 快照捕获前通知其它动效收敛：活文档将被快照树替换，进行中的过渡会冻结在快照里
  for (const listener of startListeners) listener()
  setGeometry(transition.x, transition.y)
  try {
    const vt = document.startViewTransition(() =>
      commit(transition.apply, transition.rollback)
    )
    active = { vt, priority }
    debugLog("transition start", { priority })
    // finished 迟迟不落（浏览器挂起、窗口中途隐藏等）时强制解锁，避免队列永久卡住
    const watchdog = window.setTimeout(() => {
      if (active?.vt !== vt) return
      active = null
      debugLog("transition watchdog", { priority })
      drain()
    }, WATCHDOG_MS)
    // 中止/跳过（窗口隐藏无帧、重复过渡等）只意味着没动画，状态已落地，无需回滚；
    // 但两条 promise 会 reject，不接住就是控制台里的未处理拒绝
    vt.ready.catch(() => {})
    void vt.finished
      .catch(() => {})
      .then(() => {
        window.clearTimeout(watchdog)
        // 已被看门狗接管：不再重复推进队列
        if (active?.vt !== vt) return
        active = null
        debugLog("transition end", { priority })
        drain()
      })
  } catch {
    // startViewTransition 自身抛错（文档未激活）：回调还没跑，直接无动画切换
    commitDirect(transition, "fallback")
  }
}

/** 排空队列：手动优先，其次系统；每条过渡启动前都会重新检查降级条件 */
function drain(): void {
  const next = queuedUser ?? queuedSystem
  queuedUser = null
  queuedSystem = null
  if (next) start(next, next.priority ?? "user")
}

/** 圆心与终点半径（起点到最远角的距离）写入 CSS 变量，供 keyframes 取用 @param x 起点 x @param y 起点 y */
function setGeometry(x: number, y: number): void {
  const style = document.documentElement.style
  style.setProperty("--vt-x", `${x}px`)
  style.setProperty("--vt-y", `${y}px`)
  style.setProperty(
    "--vt-r",
    `${Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))}px`
  )
}

/** 无动画直接提交并记跳过原因 @param transition 事务 @param reason 跳过原因 */
function commitDirect(transition: ThemeTransition, reason: string): void {
  debugLog("transition skipped", { reason })
  commit(transition.apply, transition.rollback)
}

/** 提交：异常说明只做了一半，当场退回切换前的主题（不重抛，避免过渡带着脏 DOM 中止）
 * @param apply 应用回调 @param rollback 回滚回调 */
function commit(apply: () => void, rollback: () => void): void {
  try {
    apply()
  } catch {
    debugLog("transition rolled back", { reason: "apply-failed" })
    rollback()
  }
}

/** 开发环境日志 @param message 文案 @param detail 明细 */
function debugLog(message: string, detail: Record<string, unknown>): void {
  if (import.meta.env.DEV) console.debug(`[theme] ${message}`, detail)
}
