// 主题切换事务：class 在回调内同步落地，动画失败则回滚。不支持 View Transitions 时降级为直接切换。
// 动画本体由 index.scss 的方向规则驱动（.dark 决定收/扩），此处只写几何参数并触发过渡。
// 点击当帧的按钮反馈归调用方的乐观层：startViewTransition 的回调在后续宏任务才执行，
// 这里再加 flushSync 只会把整棵树的同步渲染压到快照捕获之前，更卡。

/** startThemeTransition 参数 */
type ThemeTransition = {
  /** 应用新主题：同步改 html class 并置 React 状态（provider 的 setTheme 满足） */
  apply: () => void
  /** 提交半途失败时回到切换前的主题（同步，不带动画） */
  rollback: () => void
  /** 动画起点 x 坐标（点击点） */
  x: number
  /** 动画起点 y 坐标 */
  y: number
}

/**
 * 圆形揭示切换主题：切深色时旧快照收缩回起点，切浅色时新快照从起点扩散
 * @param transition 切换事务（apply/rollback/起点坐标）
 */
export function startThemeTransition({
  apply,
  rollback,
  x,
  y,
}: ThemeTransition): void {
  if (!("startViewTransition" in document)) {
    commit(apply, rollback)
    return
  }

  // 圆心与终点半径（起点到最远角的距离）写入 CSS 变量，供 keyframes 取用
  const style = document.documentElement.style
  style.setProperty("--vt-x", `${x}px`)
  style.setProperty("--vt-y", `${y}px`)
  style.setProperty(
    "--vt-r",
    `${Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))}px`
  )

  try {
    const transition = document.startViewTransition(() =>
      commit(apply, rollback)
    )
    // 中止/跳过（窗口隐藏无帧、重复过渡等）只意味着没动画，状态已落地，无需回滚；
    // 但两条 promise 会 reject，不接住就是控制台里的未处理拒绝
    transition.ready.catch(() => {})
    transition.finished.catch(() => {})
  } catch {
    // startViewTransition 自身抛错（文档未激活）：回调还没跑，直接无动画切换
    commit(apply, rollback)
  }
}

/** 提交：异常说明只做了一半，当场退回切换前的主题（不重抛，避免过渡带着脏 DOM 中止）
 * @param apply 应用回调 @param rollback 回滚回调 */
function commit(apply: () => void, rollback: () => void): void {
  try {
    apply()
  } catch {
    rollback()
  }
}
