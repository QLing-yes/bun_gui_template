import * as React from "react"

import { readText, storageArea, STORAGE_KEYS, writeText } from "@/lib/storage"
import { setWindowTheme } from "@/lib/tauri"

export type Theme = "dark" | "light" | "system"
type ResolvedTheme = "dark" | "light"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
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
  defaultTheme = "light",
  storageKey = STORAGE_KEYS.theme,
  disableTransitionOnChange = true,
  ...props
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(() => {
    const storedTheme = readText(storageKey)
    if (isTheme(storedTheme)) {
      return storedTheme
    }

    return defaultTheme
  })
  const [systemDark, setSystemDark] = React.useState(
    () => getSystemTheme() === "dark"
  )
  /** 系统当前偏好（媒体状态解析） */
  const systemTheme: ResolvedTheme = systemDark ? "dark" : "light"
  /** 当前生效主题：system 由系统偏好解析，其余即本值 */
  const resolvedTheme: ResolvedTheme = theme === "system" ? systemTheme : theme

  const applyTheme = React.useCallback(
    (nextTheme: Theme) => {
      const root = document.documentElement
      const next = nextTheme === "system" ? getSystemTheme() : nextTheme
      // VT 可用时切换被快照盖住，防 CSS 过渡注入毫无作用还产生 DOM 扰动；仅降级路径需要
      const restoreTransitions =
        disableTransitionOnChange && !("startViewTransition" in document)
          ? disableTransitionsTemporarily()
          : null

      root.classList.remove("light", "dark")
      root.classList.add(next)
      // 顶边描边已由 web 自绘，这里只同步 OS 侧明暗（任务栏缩略图/DWM 着色）
      setWindowTheme(next === "dark")

      if (restoreTransitions) {
        restoreTransitions()
      }
    },
    [disableTransitionOnChange]
  )

  const setTheme = React.useCallback(
    (nextTheme: Theme) => {
      writeText(storageKey, nextTheme)
      // class 必须在回调内同步落：新快照在本次回调返回后才捕获
      applyTheme(nextTheme)
      setThemeState(nextTheme)
    },
    [storageKey, applyTheme]
  )

  // 挂载/主题变化时落 class，并始终订阅系统主题（媒体回调属事件驱动 setState）
  React.useLayoutEffect(() => {
    applyTheme(theme)
    const mediaQuery = window.matchMedia(COLOR_SCHEME_QUERY)
    const handleChange = () => {
      setSystemDark(mediaQuery.matches)
      applyTheme(theme)
    }

    mediaQuery.addEventListener("change", handleChange)

    return () => {
      mediaQuery.removeEventListener("change", handleChange)
    }
  }, [theme, applyTheme])

  React.useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.storageArea !== storageArea()) {
        return
      }

      if (event.key !== storageKey) {
        return
      }

      if (isTheme(event.newValue)) {
        setThemeState(event.newValue)
        return
      }

      setThemeState(defaultTheme)
    }

    window.addEventListener("storage", handleStorageChange)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
    }
  }, [defaultTheme, storageKey])

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
