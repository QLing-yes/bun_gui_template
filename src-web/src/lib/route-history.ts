// 路由历史：全应用唯一一处读 history.state.idx，前进/后退可用性与历史穿越方向都从这里出
// 历史穿越（后退/前进按钮）只比一条历史：条目号比上一条小＝往左，否则＝往右
// 菜单/链接点击是新条目，条目号只会变大，方向由轨道按目标槽在哪一侧定（来回点两个菜单才会左右交替）
// popstate 标记本次是否穿越，并维护前进上界（push 会截断前进栈）

/** 上一条历史记录的条目号（判方向的唯一依据） */
let prevIdx: number | null = null

/** 同条目重复观察时沿用的判定（replace / dev 双跑不产生方向抖动） */
let prevBack = false

/** 见过的最大条目序号＝前进上界；push/replace 会截断前进栈 */
let top = Math.max(0, window.history.length - 1)

/** 本次地址变化是否来自历史穿越（只用于前进上界） */
let popped = false

/** popstate 监听只装一次 */
let listening = false

/** 读不到 history.state.idx 时的兜底条目号（只在观察时推进，快照只读，避免每次读都变） */
let guess = 0

/** history.state.idx（react-router 维护），读不到返回 null */
function rawIdx(): number | null {
  const { idx } = (window.history.state ?? {}) as { idx?: number }
  return typeof idx === "number" ? idx : null
}

/** 当前条目号 */
function currentIdx(): number {
  return rawIdx() ?? guess
}

/** 可用性订阅者 */
const listeners = new Set<() => void>()

/** 可用性快照（值不变时复用同一对象，满足 useSyncExternalStore 的引用稳定要求） */
let snapshot = { canGoBack: false, canGoForward: false }

/** 装上 popstate 标记监听（只装一次） */
function ensureListener(): void {
  if (listening) return
  listening = true
  window.addEventListener("popstate", () => {
    popped = true
    notify()
  })
}

/** 通知可用性订阅者（快照在下次读取时按实时值重建） */
function notify(): void {
  for (const listener of listeners) listener()
}

/**
 * 观察一次地址变化：记下本条历史位置，并给出这次切页往左还是往右
 * @returns back 条目号比上一条小＝往左；traversed 本次是否历史穿越（后退/前进按钮）
 */
export function observePath(): { back: boolean; traversed: boolean } {
  ensureListener()
  const idx = currentIdx()
  const traversed = popped

  // 停在同一历史条目（replace、重复观察）：沿用上次判定
  if (prevIdx !== null && idx === prevIdx) return { back: prevBack, traversed }

  const back = prevIdx !== null && idx < prevIdx

  guess = idx + 1
  top = traversed ? Math.max(top, idx) : idx
  popped = false
  prevIdx = idx
  prevBack = back

  notify()
  return { back, traversed }
}

/** 订阅历史可用性变化 @param listener 变化回调 @returns 退订函数 */
export function subscribeHistory(listener: () => void): () => void {
  ensureListener()
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * 前进/后退可用性快照：每次读取都按实时条目与前进上界重建
 * @returns canGoBack 可后退；canGoForward 可前进
 */
export function historySnapshot() {
  const idx = currentIdx()
  const next = { canGoBack: idx > 0, canGoForward: idx < top }
  if (
    next.canGoBack !== snapshot.canGoBack ||
    next.canGoForward !== snapshot.canGoForward
  ) {
    snapshot = next
  }
  return snapshot
}
