// 路由轨道：内容区的轮播式切页容器——最多 3 个页面槽，当前页居中，其余保活并冻结
// 切页＝整条轨道水平平移一个槽宽：前翻新页从左侧紧贴挤入、旧页右移出屏，后翻＝镜像，
// 期间只有 transform、没有透明度变化，标题栏与侧栏留在原位（动画局部性）
// 前翻/后翻按浏览器历史条目序号（history.state.idx）判：变大＝前翻，变小＝后翻
// 触发只有一处路由监听（本组件）：动画种类读 routes/registry 的 handle.motion，方向读 lib/route-history（只比上一条历史条目号）
// 方向判据＝目标页上次所在的条目比当前页靠前⇒后翻，账本里没见过⇒前翻（菜单点击两个方向都会出现）
// 槽的屏幕位置 = 槽左边距(-seq × 100%) + 轨道位移(activeSeq × 100%)：seq 越大越靠左、越新

import {
  Suspense,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
} from "react"

import {
  NavigationType,
  UNSAFE_LocationContext as LocationContext,
  parsePath,
  useLocation,
} from "react-router"
import type { Location } from "react-router"

import { PAGE_PAD_CLASS } from "@/components/layout/class-names"
import { CanvasOwner, PageCanvas } from "@/components/layout/page-canvas"
import { RevealPolicyProvider } from "@/components/stagger-reveal"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { useAccess } from "@/lib/access"
import { observePath } from "@/lib/route-history"
import { AccessDeniedPage } from "@/routes/pages/empty-state"
import { resolveRoute } from "@/routes/registry"
import { cn } from "cn"

/** 同时存活的页面槽上限（当前页 + 左右邻位各一） */
const SLOT_MAX = 3

/** 相对当前页最多隔几槽仍保留（超出即整屏之外，可裁） */
const SLOT_RADIUS = (SLOT_MAX - 1) / 2

/** transitionend 兜底时长：过渡事件丢失（无位移差、被系统打断等）时靠它收尾 */
const PAN_FALLBACK_MS = 600

/** 轨道里的一个页面槽 @property key 槽身份（按该页 query 档取路径名或完整地址） @property path 冻结时的完整地址 @property seq 轨道序号 @property ready 页面是否已真正挂载（骨架屏阶段为 false，不保活） */
type Slot = { key: string; path: string; seq: number; ready: boolean }

/** 轨道状态 @property slots 在册槽 @property activeKey 当前槽 @property activeSeq 当前槽序号 @property panning 平移进行中 */
type Track = {
  slots: Slot[]
  activeKey: string
  activeSeq: number
  panning: boolean
}

/** 轨道动作：navigate 换页（path 完整地址 / key 槽身份 / back 历史判的方向 / traversed 是否历史穿越 / pan 是否走轨道平移），ready 页面挂载完成，settle 平移收尾 */
type TrackAction =
  | {
      type: "navigate"
      path: string
      key: string
      back: boolean
      traversed: boolean
      pan: boolean
    }
  | { type: "ready"; key: string }
  | { type: "settle" }

/** 初始状态（未挂任何槽） */
const initialTrack: Track = {
  slots: [],
  activeKey: "",
  activeSeq: 0,
  panning: false,
}

/**
 * 收尾裁剪：只留邻位以内、且已真正挂载的槽
 * 还在骨架屏阶段的非当前槽直接丢掉（不保活、不占缓存名额），当前槽留着等它加载完
 * @param t 轨道状态 @returns 裁剪后的状态
 */
function prune(t: Track): Track {
  return {
    ...t,
    panning: false,
    slots: t.slots.filter(
      (s) =>
        Math.abs(s.seq - t.activeSeq) <= SLOT_RADIUS &&
        (s.ready || s.key === t.activeKey)
    ),
  }
}

/** 轨道状态迁移 @param state 当前状态 @param action 动作 @returns 新状态（无变化时原样返回） */
function trackReducer(state: Track, action: TrackAction): Track {
  if (action.type === "settle") {
    return state.panning ? prune(state) : state
  }

  // 页面挂载完成：标记该槽可保活（骨架屏阶段的槽不参与缓存）
  if (action.type === "ready") {
    const slot = state.slots.find((s) => s.key === action.key)
    if (!slot || slot.ready) return state
    return {
      ...state,
      slots: state.slots.map((s) =>
        s.key === action.key ? { ...s, ready: true } : s
      ),
    }
  }

  const current = state.slots.find((s) => s.key === action.key)

  // 同一槽（地址没变，或重复观察到同一 key）：只更新该槽地址，不平移
  if (state.activeKey === action.key) {
    if (!current || current.path === action.path) return state
    return {
      ...state,
      slots: state.slots.map((s) =>
        s.key === action.key ? { ...s, path: action.path } : s
      ),
    }
  }

  // 方向：历史穿越听历史（条目号变小＝往左）；菜单点击是新条目、条目号只会变大，改听目标槽在哪一侧
  // （停在左邻→往右、停在右邻→往左），这样来回点两个菜单才会左右交替；没缓存过的新页一律往右
  const back =
    action.traversed || !current ? action.back : current.seq < state.activeSeq

  // 目标页摆到当前页相邻的一格（前翻左邻 +1、后翻右邻 -1）：位移恒为一个槽宽，中间页不会横穿屏幕
  const seq = state.activeSeq + (back ? -1 : 1)
  // 那格若被别的页占着，作废它（push 本就截断前向历史）；改 seq 不改数组顺序，槽内滚动位置不受影响
  const clash = state.slots.find((s) => s.seq === seq && s.key !== action.key)
  const slots = state.slots
    .filter((s) => s !== clash)
    .map((s) => (s.key === action.key ? { ...s, path: action.path, seq } : s))
  if (!current)
    slots.push({ key: action.key, path: action.path, seq, ready: false })

  // 首次挂载与 enter:none 的页不平移（直接落位并当场裁槽），其余一律平移一格
  const next: Track = {
    slots,
    activeKey: action.key,
    activeSeq: seq,
    panning: state.slots.length > 0 && action.pan,
  }
  return action.pan ? next : prune(next)
}

/**
 * 就绪信号：放在 Suspense 内，页面真正挂载后才触发（骨架屏阶段不触发）
 * @param slotKey 槽身份 @param onReady 通知轨道该槽可保活
 */
function SlotReady({
  slotKey,
  onReady,
}: {
  slotKey: string
  onReady: (key: string) => void
}) {
  useEffect(() => onReady(slotKey), [slotKey, onReady])
  return null
}

/** 懒加载骨架：与页面同用 PageCanvas 衬底，避免切换瞬间只剩空白（仅本轨道的 Suspense 使用） */
function PageSkeleton() {
  return (
    <PageCanvas>
      <div className={cn("flex flex-col gap-4", PAGE_PAD_CLASS)}>
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-44 max-w-md rounded-lg" />
      </div>
    </PageCanvas>
  )
}

/**
 * 页面槽：按该槽地址解析一次路由，据此覆盖 Location（冻结页不跟随当前 URL）、
 * 声明该页的页内错峰档、铺该页元素，并自带滚动区；画布只归当前槽
 * memo 边界：外壳 store 变更（滑杆、侧栏换态）不再波及保活着色完的页面子树
 * @param slot 槽数据 @param active 是否当前页 @param onReady 页面挂载完成的通知
 */
const PageSlot = memo(function PageSlot({
  slot,
  active,
  onReady,
}: {
  slot: Slot
  active: boolean
  onReady: (key: string) => void
}) {
  /** 路由准入判定（账号变化即重算）：菜单与页面共用 lib/access 的同一份声明与判定 */
  const checkAccess = useAccess()
  const resolved = useMemo(() => {
    const route = resolveRoute(slot.path)
    const { pathname, search, hash } = parsePath(slot.path)
    const location: Location = {
      pathname: pathname ?? "/",
      search: search ?? "",
      hash: hash ?? "",
      state: null,
      key: slot.key,
    }
    return {
      Component: route.Component,
      access: route.access,
      // 无权限时不渲染目标页（也就不会加载它的懒分包），改由页面层展示无权限空状态
      allowed: checkAccess(route.access),
      reveal: route.motion.reveal,
      contextValue: { location, navigationType: NavigationType.Pop },
    }
  }, [slot.path, slot.key, checkAccess])

  const { Component, access, allowed, reveal } = resolved

  return (
    <div
      data-slot="page-track-slot"
      data-active={active || undefined}
      inert={!active}
      aria-hidden={!active}
      style={{ left: `${-slot.seq * 100}%` }}
    >
      <LocationContext.Provider value={resolved.contextValue}>
        <CanvasOwner active={active}>
          <RevealPolicyProvider reveal={reveal}>
            <ScrollArea className="h-full text-sm">
              <Suspense fallback={<PageSkeleton />}>
                <SlotReady slotKey={slot.key} onReady={onReady} />
                {allowed ? (
                  Component ? (
                    <Component />
                  ) : null
                ) : (
                  <AccessDeniedPage access={access} />
                )}
              </Suspense>
            </ScrollArea>
          </RevealPolicyProvider>
        </CanvasOwner>
      </LocationContext.Provider>
    </div>
  )
})

/** 内容区路由轨道（替换 Outlet，挂在 SidebarInset 下） */
export const PageTrack = memo(function PageTrack() {
  const location = useLocation()
  const [track, dispatch] = useReducer(trackReducer, initialTrack)
  const panRef = useRef<HTMLDivElement>(null)
  /** 页面挂载完成的通知（稳定引用，避免就绪信号反复触发） @param key 槽身份 */
  const markReady = useCallback(
    (key: string) => dispatch({ type: "ready", key }),
    []
  )

  // 全应用唯一的路由监听：地址一变就查动效档、记账判方向，动画种类与前后翻都在这儿定，按钮不参与
  useLayoutEffect(() => {
    const path = location.pathname + location.search + location.hash
    const motion = resolveRoute(path).motion
    // 槽身份按 query 档取：local＝同路径恒一槽，slot＝每个完整地址各自成槽
    const key = motion.query === "slot" ? path : location.pathname
    const { back, traversed } = observePath()

    dispatch({
      type: "navigate",
      path,
      key,
      back,
      traversed,
      pan: motion.enter === "pan",
    })
  }, [location])

  // 平移收尾：解除离屏槽的可见性豁免并裁剪超出的槽；每次换页重挂监听并重置兜底计时
  useEffect(() => {
    const el = track.panning ? panRef.current : null
    if (!el) return

    const settle = () => dispatch({ type: "settle" })
    const onEnd = (e: TransitionEvent) => {
      if (e.target === el && e.propertyName === "transform") settle()
    }

    el.addEventListener("transitionend", onEnd)
    const timer = window.setTimeout(settle, PAN_FALLBACK_MS)
    return () => {
      el.removeEventListener("transitionend", onEnd)
      window.clearTimeout(timer)
    }
  }, [track.panning, track.activeSeq])

  return (
    <div data-slot="page-track" data-panning={track.panning || undefined}>
      <div
        data-slot="page-track-pan"
        ref={panRef}
        style={{ transform: `translateX(${track.activeSeq * 100}%)` }}
      >
        {track.slots.map((slot) => (
          <PageSlot
            key={slot.key}
            slot={slot}
            active={slot.key === track.activeKey}
            onReady={markReady}
          />
        ))}
      </div>
    </div>
  )
})
