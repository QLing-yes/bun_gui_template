// 全局 UI 状态：zustand + persist（键名登记见 lib/storage.ts，跨重启保留）
// 约定：跨组件共享且需要持久化的状态放这里；组件内瞬时状态用 useState，不落盘

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { storageAdapter, STORAGE_KEYS } from "@/lib/storage"
import { WIDTH_MAX, WIDTH_MIN } from "@/lib/sidebar-channel"

/** 侧栏显示模式：完全显示 / 图标折叠 / 完全隐藏 */
export type SidebarMode = "expanded" | "icon" | "hidden"

/** 三态循环顺序：显示 → 折叠 → 隐藏 → 显示 */
const modeNext: Record<SidebarMode, SidebarMode> = {
  expanded: "icon",
  icon: "hidden",
  hidden: "expanded",
}

/** 三态 → 注册表 collapsible：hidden 走 offcanvas 左滑出屏，其余走图标折叠 */
export function collapsibleFor(mode: SidebarMode): "offcanvas" | "icon" {
  return mode === "hidden" ? "offcanvas" : "icon"
}

/** 三态 → 注册表 open 布尔（provider 只认二态；此处为唯一翻译点） */
export function openFor(mode: SidebarMode): boolean {
  return mode === "expanded"
}

/** 注册表 open 变化 → 三态：抽屉开合只会落到 显示/折叠，绝不产生 hidden
 * @param open provider 的新 open 值 @param current 当前模式 @returns 目标模式 */
export function modeFromOpen(open: boolean, current: SidebarMode): SidebarMode {
  if (open) return "expanded"
  return current === "hidden" ? "hidden" : "icon"
}

/** 数值夹取（设置页滑杆与持久化数据共用同一约束） */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)))
}

/** 窗口四角圆角半径（px，0=直角），字段名即 CSS border-radius 的四角顺序 */
export interface WindowCorners {
  /** 左上角 */
  topLeft: number
  /** 右上角 */
  topRight: number
  /** 右下角 */
  bottomRight: number
  /** 左下角 */
  bottomLeft: number
}

/** 可单独调节的角位 */
export type CornerSide = keyof WindowCorners

/** 侧栏展开宽默认档（px，与 index.scss `--sidebar-width` 兜底同值） */
const SIDEBAR_WIDTH_DEFAULT = 260
/** 磨砂自糊半径默认档（px，与 index.scss `--glass-blur` 兜底同值） */
const BLUR_DEFAULT = 12
/** 磨砂半径上限（px，供设置页滑杆同档） */
export const BLUR_MAX = 48
/** 内容面壳色不透明度默认档（%，与 index.scss `--film-a` 兜底同值） */
const FILM_DEFAULT = 76
/** 不透明度上限（%，100 即无透出） */
export const FILM_MAX = 100
/** 圆角默认半径（index.scss 兜底恒取 0，避免 web 档首帧人为裁角） */
const RADIUS_DEFAULT = 7
/** 圆角半径上限（px，供设置页滑杆同档） */
export const RADIUS_MAX = 24
/** 衬层背景渐变默认开关（与 index.scss `--wash-a` 兜底同档：开=两处径向晕染可见） */
const WASH_DEFAULT = true

/** 脏数据防线：持久值可能是非数字或 NaN/Infinity（手改存储即得），一律回落默认档
 * （否则会写成 `--app-radius: NaNpx`，整条声明被 CSS 丢弃） @param value 持久值 @param fallback 默认档 */
function stored(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

/** 布尔档收敛：非布尔的持久值回落默认档 @param value 持久值 @param fallback 默认档 */
function storedBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback
}

/** 四角同值 @param px 半径 @returns 四角对象 */
function cornersOf(px: number): WindowCorners {
  return { topLeft: px, topRight: px, bottomRight: px, bottomLeft: px }
}

/** 持久化的 UI 状态字段与行为 */
interface UiState {
  /** 侧栏当前显示模式 */
  sidebarMode: SidebarMode
  /** 设置侧栏模式 @param mode 目标模式 */
  setSidebarMode: (mode: SidebarMode) => void
  /** 按 显示→折叠→隐藏 顺序切换下一模式 */
  cycleSidebarMode: () => void
  /** 侧栏展开宽度（px，拖拽调节后持久化） */
  sidebarWidth: number
  /** 设置侧栏宽度 @param width 像素宽度 */
  setSidebarWidth: (width: number) => void
  /** 内容面自糊半径（px，0=不糊；CSS 侧唯一模糊来源） */
  glassBlur: number
  /** 设置自糊半径 @param px 像素半径 */
  setGlassBlur: (px: number) => void
  /** 内容面壳色不透明度（%；衬层恒实心，不受此项影响） */
  glassFilm: number
  /** 设置不透明度 @param percent 百分比 */
  setGlassFilm: (percent: number) => void
  /** 主界面背景渐变（衬层两处径向晕染）是否开启 */
  bgWash: boolean
  /** 设置背景渐变开关 @param on 是否开启 */
  setBgWash: (on: boolean) => void
  /** 窗口四角圆角半径（个性化可调，经圆角通道输出值，作用于 html/body 裁切层、描边与 VT 底色层） */
  corners: WindowCorners
  /** 设置某个角的半径 @param side 角位 @param px 半径（夹到 0–RADIUS_MAX） */
  setCorner: (side: CornerSide, px: number) => void
  /** 个性化恢复默认档（磨砂两项 + 背景渐变 + 四角半径；不动侧栏模式与宽度） */
  resetPersonalize: () => void
}

/** UI store 的数据字段（迁移函数只回这些） */
type UiData = Pick<
  UiState,
  | "sidebarMode"
  | "sidebarWidth"
  | "glassBlur"
  | "glassFilm"
  | "bgWash"
  | "corners"
>

/** 把任意持久化载荷读成当前版本的数据字段：补齐缺失、收敛脏值、执行版本迁移
 * （v0→v1 二态侧栏→三态；v1→v2 加磨砂三项；v2→v3 撤系统材质；v3→v4 圆角半径从 Rust
 *   备忘录迁进本 store，四角独立持久化；v4 之后新增字段靠 merge 每次加载补齐，无需再抬版本号。
 *   默认档变化不做旧数据兼容：旧值原样留着，需要统一由用户在个性化里重置）
 * @param persisted 存储里的 state 载荷（版本迁移后的结果） @returns 合法数据字段 */
function readUiData(persisted: unknown): UiData {
  const s = (persisted ?? {}) as Partial<UiState> & {
    sidebarCollapsed?: boolean
  }
  const c = s.corners
  return {
    sidebarMode:
      s.sidebarMode ?? (s.sidebarCollapsed ? ("icon" as const) : "expanded"),
    sidebarWidth: clamp(
      stored(s.sidebarWidth, SIDEBAR_WIDTH_DEFAULT),
      WIDTH_MIN,
      WIDTH_MAX
    ),
    glassBlur: clamp(stored(s.glassBlur, BLUR_DEFAULT), 0, BLUR_MAX),
    glassFilm: clamp(stored(s.glassFilm, FILM_DEFAULT), 0, FILM_MAX),
    bgWash: storedBool(s.bgWash, WASH_DEFAULT),
    corners: {
      topLeft: clamp(stored(c?.topLeft, RADIUS_DEFAULT), 0, RADIUS_MAX),
      topRight: clamp(stored(c?.topRight, RADIUS_DEFAULT), 0, RADIUS_MAX),
      bottomRight: clamp(stored(c?.bottomRight, RADIUS_DEFAULT), 0, RADIUS_MAX),
      bottomLeft: clamp(stored(c?.bottomLeft, RADIUS_DEFAULT), 0, RADIUS_MAX),
    },
  }
}

/** 全局 UI store；仅数据字段序列化到持久化层（函数值自动跳过） */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarMode: "expanded",
      setSidebarMode: (mode) => set({ sidebarMode: mode }),
      cycleSidebarMode: () =>
        set((s) => ({ sidebarMode: modeNext[s.sidebarMode] })),
      sidebarWidth: SIDEBAR_WIDTH_DEFAULT,
      setSidebarWidth: (width) => set({ sidebarWidth: width }),
      glassBlur: BLUR_DEFAULT,
      setGlassBlur: (px) => set({ glassBlur: clamp(px, 0, BLUR_MAX) }),
      glassFilm: FILM_DEFAULT,
      setGlassFilm: (percent) =>
        set({ glassFilm: clamp(percent, 0, FILM_MAX) }),
      bgWash: WASH_DEFAULT,
      setBgWash: (on) => set({ bgWash: on }),
      corners: cornersOf(RADIUS_DEFAULT),
      setCorner: (side, px) =>
        set((s) => ({
          corners: { ...s.corners, [side]: clamp(px, 0, RADIUS_MAX) },
        })),
      resetPersonalize: () =>
        set({
          glassBlur: BLUR_DEFAULT,
          glassFilm: FILM_DEFAULT,
          bgWash: WASH_DEFAULT,
          corners: cornersOf(RADIUS_DEFAULT),
        }),
    }),
    {
      name: STORAGE_KEYS.ui,
      version: 4,
      migrate: readUiData,
      // 落盘统一走 lib/storage 的按键防抖，滑杆拖动期不再逐帧同步写
      storage: createJSONStorage(() => storageAdapter),
      // merge 每次加载都跑（migrate 只在版本变化时跑），同版本的手改脏值也在这里挡住
      merge: (persisted, current) => ({ ...current, ...readUiData(persisted) }),
    }
  )
)
