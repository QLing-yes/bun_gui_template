import * as React from "react"

import { STORAGE_KEYS, subscribeStorageKey, writeText } from "@/lib/storage"
import { setWindowTheme } from "@/lib/tauri"
import { cancelSystemTransitions, startThemeTransition } from "@/lib/theme-transition"

export type Theme = "dark" | "light" | "system"
type ResolvedTheme = "dark" | "light"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  /** AppBoot 从 IndexedDB 读出的初始档位；非法或缺失时回落 defaultTheme */
  initialTheme?: string | null
  /** 明暗偏好的存储键 */
  storageKey?: string
  disableTransitionOnChange?: boolean
}

type ThemeProviderState = {
  theme: Theme
  /** 当前生效主题（system 已解析为实际值） */
  resolvedTheme: ResolvedTheme
  /** 系统当前偏好（system 档的解析来源，供切换前预判生效明暗是否变化） */
  systemTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)"
const THEME_VALUES: Theme[] = ["dark", "light", "system"]

const ThemeProviderContext = React.createContext<
  ThemeProviderState | undefined
>(undefined)

function isTheme(value: string | null): value is Theme {
  if (value === null) {
    return false
  }

  return THEME_VALUES.includes(value as Theme)
}

function getSystemTheme(): ResolvedTheme {
  if (window.matchMedia(COLOR_SCHEME_QUERY).matches) {
    return "dark"
  }

  return "light"
}

function disableTransitionsTemporarily() {
  const style = document.createElement("style")
  style.appendChild(
    document.createTextNode(
      "*,*::before,*::after{-webkit-transition:none!important;transition:none!important}"
    )
  )
  document.head.appendChild(style)

  return () => {
    window.getComputedStyle(document.body)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        style.remove()
      })
    })
  }
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  initialTheme = null,
  storageKey = STORAGE_KEYS.theme,
  disableTransitionOnChange = true,
  ...props
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(() => {
    const resolved = isTheme(initialTheme) ? initialTheme : defaultTheme
    if (import.meta.env.DEV) {
      console.debug("[theme] init", { stored: initialTheme, mode: resolved })
    }

    return resolved
  })
  const [systemDark, setSystemDark] = React.useState(
    () => getSystemTheme() === "dark"
  )
  /** 系统当前偏好（媒体状态解析） */
  const systemTheme: ResolvedTheme = systemDark ? "dark" : "light"
  /** 当前生效主题：system 由系统偏好解析，其余即本值 */
  const resolvedTheme: ResolvedTheme = theme === "system" ? systemTheme : theme
  /** 系统偏好最新目标值：事件回调里立即更新，避免过渡回调尚未提交时用旧 state 去重、把系统抖动漏掉 */
  const systemTarget = React.useRef<ResolvedTheme>(systemTheme)

  const applyTheme = React.useCallback(
    (nextTheme: Theme, resolvedOverride?: ResolvedTheme) => {
      const root = document.documentElement
      // system 档解析实时系统偏好；过渡回滚等场景可显式指定解析结果
      const next =
        resolvedOverride ??
        (nextTheme === "system" ? getSystemTheme() : nextTheme)
      // VT 可用时切换被快照盖住，防 CSS 过渡注入毫无作用还产生 DOM 扰动；仅降级路径需要
      const restoreTransitions =
        disableTransitionOnChange && !("startViewTransition" in document)
          ? disableTransitionsTemporarily()
          : null

      root.classList.remove("light", "dark")
      root.classList.add(next)
      // 固定档才显式钉住窗口原生明暗；跟随系统必须交还 null：Windows 会把显式值写进
      // WebView2 的 PreferredColorScheme，钉住后 prefers-color-scheme 不再随 OS 变化
      setWindowTheme(nextTheme === "system" ? null : next === "dark")
      if (import.meta.env.DEV) {
        console.debug("[theme] apply", { mode: nextTheme, resolved: next })
      }

      if (restoreTransitions) {
        restoreTransitions()
      }
    },
    [disableTransitionOnChange]
  )

  const setTheme = React.useCallback(
    (nextTheme: Theme) => {
      // 异步落 IndexedDB；首帧提示 cookie 由存储门面同步刷新，下一次启动仍能立即定色
      void writeText(storageKey, nextTheme)
      // class 必须在回调内同步落：新快照在本次回调返回后才捕获
      applyTheme(nextTheme)
      setThemeState(nextTheme)
      if (import.meta.env.DEV) {
        console.debug("[theme] persist", { mode: nextTheme })
      }
    },
    [storageKey, applyTheme]
  )

  // 档位变化时落 class（系统偏好变化不在这里重复落，交给下面的事件回调按动画链处理）
  React.useLayoutEffect(() => {
    applyTheme(theme)
  }, [theme, applyTheme])

  // 始终订阅系统主题：固定档只刷新系统偏好，跟随系统档复用同一套圆形揭示过渡
  React.useLayoutEffect(() => {
    const mediaQuery = window.matchMedia(COLOR_SCHEME_QUERY)
    const handleChange = () => {
      const next: ResolvedTheme = mediaQuery.matches ? "dark" : "light"
      if (import.meta.env.DEV) {
        console.debug("[theme] system-changed", {
          mode: theme,
          from: systemTarget.current,
          to: next,
        })
      }

      // 固定档下系统变化不改视觉，只刷新系统偏好，供下一次切回「跟随系统」时解析
      if (theme !== "system") {
        systemTarget.current = next
        setSystemDark(next === "dark")
        if (import.meta.env.DEV) {
          console.debug("[theme] system change skipped", { reason: "fixed-mode" })
        }
        return
      }
      if (next === systemTarget.current) return

      // 跟随系统：复用手动切换的同一套圆形揭示过渡（系统变化没有点击点，取视口中心）
      const previous = systemTarget.current
      systemTarget.current = next
      /** 落系统偏好的目标值（提交与回滚共用） @param target 目标明暗 */
      const commitSystem = (target: ResolvedTheme) => {
        systemTarget.current = target
        setSystemDark(target === "dark")
        applyTheme("system", target)
      }
      startThemeTransition({
        priority: "system",
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        // 提交时读最新目标：极快抖动下前一条过渡的 apply 尚未执行，按最新值落可避免闪一帧中间色
        apply: () => commitSystem(systemTarget.current),
        rollback: () => commitSystem(previous),
      })
    }

    mediaQuery.addEventListener("change", handleChange)

    return () => {
      mediaQuery.removeEventListener("change", handleChange)
    }
  }, [theme, applyTheme])

  // 跨窗口同步：其它窗口改了主题，经持久化门面广播回查后在此收敛（本窗口写入会回显同值，直接忽略）
  React.useEffect(
    () =>
      subscribeStorageKey(storageKey, (next) => {
        if (!isTheme(next)) return
        // 其它窗口的手动选择同样压过本窗口待播的系统抖动，避免系统过渡把远端选择覆盖
        cancelSystemTransitions()
        setThemeState((current) => (next === current ? current : next))
      }),
    [storageKey]
  )

  const value = React.useMemo(
    () => ({
      theme,
      resolvedTheme,
      systemTheme,
      setTheme,
    }),
    [theme, resolvedTheme, systemTheme, setTheme]
  )

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = React.useContext(ThemeProviderContext)

  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }

  return context
}
