// 错峰入场容器：直接子元素逐个进场；trigger 变化时重放（档位与 anime.js 接入都在 lib/motion）
// 是否播放由路由元数据声明（RevealPolicy）：轨道逐槽写入该页的 reveal 档，页内不必自己判断

import { createContext, useContext, useEffect, useRef } from "react"
import type { ReactNode } from "react"

import { cn } from "cn"

import { revealStagger, useMotionScope } from "@/lib/motion"

/** 页内错峰策略：stagger＝播放，none＝该页不播内容块进场 */
export type RevealPolicy = "stagger" | "none"

/** 当前页的错峰策略（轨道外的内容默认播放，如登录页） */
const policyContext = createContext<RevealPolicy>("stagger")

/** 声明这棵子树所在页的错峰策略 @param reveal 策略 @param children 页面内容 */
export function RevealPolicyProvider({
  reveal,
  children,
}: {
  reveal: RevealPolicy
  children: ReactNode
}) {
  return (
    <policyContext.Provider value={reveal}>{children}</policyContext.Provider>
  )
}

/**
 * @param children 成组内容（每个直接子元素为一个错峰单位）
 * @param className 容器类名（默认 contents，不额外造盒）
 * @param trigger 重放依赖：变化即重播，挂载时必播一次
 */
export function StaggerReveal({
  children,
  className,
  trigger,
}: {
  children: ReactNode
  className?: string
  trigger?: unknown
}) {
  const host = useRef<HTMLDivElement>(null)
  /** 该页是否允许内容块错峰（路由元数据说了算） */
  const allowed = useContext(policyContext) === "stagger"

  const { scope, ready } = useMotionScope(host, (self) => {
    self.add("enter", () => {
      if (host.current) revealStagger(host.current)
    })
  })

  useEffect(() => {
    // ready 变 true 时补播首次入场（动画库懒加载完成后作用域才可用）
    if (allowed && ready) scope.current?.methods.enter()
  }, [allowed, trigger, scope, ready])

  return (
    <div ref={host} className={cn("contents", className)}>
      {children}
    </div>
  )
}
