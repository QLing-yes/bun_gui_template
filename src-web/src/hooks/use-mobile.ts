// 桌面/移动分档的唯一 JS 来源；同值另见 index.scss 的 @theme --breakpoint-md 与媒体查询 768px
import * as React from "react"

/** 移动档上界（px）：小于此宽度走抽屉侧栏与堆叠布局；改这里必须同步 index.scss */
const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(
    () => window.innerWidth < MOBILE_BREAKPOINT
  )

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile
}
