// 窗口控制按钮组（最小化/最大化/关闭）：仅桌面端渲染，浏览器返回 null
// 贴靠布局浮层待 WebView2 WCO 稳定版转正后再接入（web 自绘按钮申报 HTMAXBUTTON 在稳定版无通道）

import { AppIcon } from "@/components/icons"

import { IconAction } from "@/components/layout/icon-action"
import {
  closeWindow,
  isTauri,
  minimizeWindow,
  toggleMaximizeWindow,
  useWindowState,
} from "@/lib/tauri"

/** 关闭按钮：悬停 Windows 原生红 + 白色图标，按下变浅
 * 色值登记为系统色例外（不随主题变，见 AGENTS 颜色规则的例外项）；其余一律走语义令牌
 */
const closeBtnClass =
  "hover:bg-[#E81123] hover:text-white active:bg-[#F1564C] active:text-white"

export function WindowControls() {
  const { isMaximized } = useWindowState()

  if (!isTauri) return null

  return (
    <>
      <IconAction hint="最小化" button={{ onClick: minimizeWindow }}>
        <AppIcon name="minus" size={16} />
      </IconAction>
      <IconAction
        hint={isMaximized ? "还原" : "最大化"}
        button={{ onClick: toggleMaximizeWindow }}
      >
        {isMaximized ? (
          <AppIcon name="copy" size={16} />
        ) : (
          <AppIcon name="square" size={16} />
        )}
      </IconAction>
      <IconAction
        hint="关闭"
        button={{ className: closeBtnClass, onClick: closeWindow }}
      >
        <AppIcon name="x" size={16} />
      </IconAction>
    </>
  )
}
