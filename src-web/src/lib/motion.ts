// 动效单源：anime.js 的唯一入口。集中接入=官方 createScope 生命周期（作用域内选择器与实例随组件卸载 revert）；
// 按需=页面自己决定挂不挂。几何动画判据（三者任一成立即只许动 transform/opacity，否则允许短时改 width/height）：
// ① 元素自身带 backdrop-filter；② 元素位于某块磨砂背后、会进对方的 backdrop 采样范围（被内容面磨砂覆盖的一切都算）；
// ③ 改动会引发大面积重排（整块位移或影响兄弟流布局）。三者都不成立的绝对定位小元素可做几何动画
// （实例：option-switch 游标拉伸，绝对定位、不在磨砂背后，宽度 keyframes 300ms、40% 处到峰值）。

import { useEffect, useRef, useState } from "react"
import type { RefObject } from "react"

import type { Scope } from "animejs"

/** anime.js 模块形状（类型引用，运行时不加载） */
type AnimeModule = typeof import("animejs")

/** 懒加载的 anime.js 模块 Promise：模块级只请求一次，首屏主包不再背动画库 */
let animeLoad: Promise<AnimeModule> | null = null

/** 取 anime.js：首次调用才拉 chunk（文件头纪律：页面仍不得直接 import animejs） */
function loadAnime(): Promise<AnimeModule> {
  return (animeLoad ??= import("animejs"))
}

/** 入场档：逐块错峰（普通块横向挤入、磨砂块淡化，距离/间隔/时长/缓动都在这里） */
const ENTRANCE = {
  distance: 24,
  gap: 40,
  duration: 300,
  ease: "out(3)",
} as const

/** 抖动档：横向往复衰减，纯反馈 */
const SHAKE = {
  duration: 320,
  ease: "outQuad",
} as const

/** 浮层关闭后再切页/切主题的等待下限（ms）：浮层还开着就动，全屏动画会在浮层背后跑完 */
export const OVERLAY_CLOSE_MS = 120

/** 是否偏好减少动效（命中则入场跳过；CSS 侧另有全局压平） */
export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/**
 * 磨砂块选择器，与 index.scss「全局磨砂衬底」那条规则同源（流程节点已退出磨砂，可自由平移）
 * 这类块被逐帧平移时 backdrop-filter 每帧都要重新采样背后像素（登录卡片进场、流程节点拖动掉帧皆此因），
 * 所以进场只淡化不平移
 */
const FROSTED =
  '[data-slot="card"]:not([data-flow-node]),' +
  '[data-slot="dropdown-menu-content"],' +
  '[data-slot="dropdown-menu-submenu-content"]'

/** 该块自身或后代是否带磨砂 @param el 块根元素 @returns 是否只允许淡化进场 */
function paintsFrost(el: HTMLElement): boolean {
  return el.matches(FROSTED) || el.querySelector(FROSTED) !== null
}

/**
 * 错峰入场：直接子元素按序进场——普通块从右侧挤入，带磨砂的块只淡化（不位移，避免每帧重模糊）
 * 动画库异步就绪后启动；容器/子元素已卸载则直接放弃
 * @param container 目标容器
 */
export function revealStagger(container: HTMLElement): void {
  if (prefersReducedMotion()) return
  const children = [...container.children] as HTMLElement[]
  void loadAnime().then(({ animate, utils }) => {
    if (!container.isConnected) return
    children.forEach((el, i) => {
      if (!el.isConnected) return
      animate(el, {
        ...(paintsFrost(el)
          ? { opacity: [0, 1] }
          : { translateX: [ENTRANCE.distance, 0] }),
        duration: ENTRANCE.duration,
        ease: ENTRANCE.ease,
        delay: i * ENTRANCE.gap,
        // 清的是动画实例登记的内联值：收尾不留 transform/opacity，否则元素长期成为 fixed 后代的包含块
        onComplete: (self) => utils.cleanInlineStyles(self),
      })
    })
  })
}

/**
 * 校验失败抖动：横向小幅往复，纯反馈不改变布局
 * @param targets 目标元素集合（空数组直接跳过）
 */
export function shake(targets: readonly HTMLElement[]): void {
  if (targets.length === 0 || prefersReducedMotion()) return
  void loadAnime().then(({ animate, utils }) => {
    const alive = targets.filter((el) => el.isConnected)
    if (alive.length === 0) return
    const animation = animate(alive, {
      keyframes: [
        { x: "-6px" },
        { x: "6px" },
        { x: "-4px" },
        { x: "4px" },
        { x: "0px" },
      ],
      duration: SHAKE.duration,
      ease: SHAKE.ease,
      onComplete: () => utils.cleanInlineStyles(animation),
    })
  })
}

/**
 * 集中接入：以 root 建 anime.js 作用域，注册表里声明的方法供组件在事件/状态变化时调用
 * 作用域只建一次；声明函数走最新引用，卸载时整体 revert
 * 动画库懒加载：作用域异步就绪，`ready` 变化时调用方才可重放入场
 * @param root 作用域根节点 ref @param register 作用域内声明动画与方法
 * @returns 作用域实例 ref（经 `.methods.<名字>()` 调用注册方法）与就绪标志
 */
export function useMotionScope(
  root: RefObject<HTMLElement | null>,
  register: (scope: Scope) => void
): { scope: RefObject<Scope | null>; ready: boolean } {
  const scope = useRef<Scope | null>(null)
  const [ready, setReady] = useState(false)
  const declare = useRef(register)

  useEffect(() => {
    declare.current = register
  })

  useEffect(() => {
    let disposed = false
    let instance: Scope | null = null
    void loadAnime().then(({ createScope }) => {
      if (disposed) return
      const created = createScope({ root })
      instance = created
      created.add(() => declare.current(created))
      scope.current = created
      setReady(true)
    })
    return () => {
      disposed = true
      instance?.revert()
      scope.current = null
      setReady(false)
    }
  }, [root])

  return { scope, ready }
}
