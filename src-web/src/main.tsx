import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router"

import "./index.scss"
import { WindowRadius } from "@/components/layout/window-radius.tsx"
import { WindowReveal } from "@/components/layout/window-reveal.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { Toaster, toast } from "@/components/ui/toast.tsx"
import { TooltipProvider } from "@/components/ui/tooltip.tsx"
import { mountLayerInspector } from "@/dev/layer-inspector.ts"
import { onSidecarTerminated } from "@/lib/tauri"
import { router } from "@/routes/router.tsx"
import { installWebviewGuards } from "@/shortcuts/webview.ts"

// 安装 WebView 全局输入守卫（桌面：右键/刷新/F11；两端：文件拖入拦截）
installWebviewGuards()

// sidecar 意外退出：留痕 + 提示本地后端不可用（/offline 会全部失败）
void onSidecarTerminated((code) => {
  console.error("[tauri] sidecar terminated, code:", code)
  toast.add({
    title: "本地服务已退出",
    description: `退出码 ${code}，离线功能暂不可用`,
    type: "error",
    timeout: 5000,
  })
})

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      {/* 提示浮层出口：main 挂一次，登录页与主壳共用（避免两处各包一层 provider） */}
      <TooltipProvider>
        <RouterProvider router={router} />
        {/* 全局提示出口（toast manager 由 ui/toast 单例提供） */}
        <Toaster />
        {/* 圆角通道：登录页与主壳共用一份持久化半径 */}
        <WindowRadius />
        {/* 首屏提交后才让窗口出场（启动阶段窗口保持最小化） */}
        <WindowReveal />
      </TooltipProvider>
    </ThemeProvider>
  </StrictMode>
)

// 层级背景检视：零依赖原生工具，仅 dev 挂载（release 分支被剔除）
if (import.meta.env.DEV) {
  mountLayerInspector()
}
