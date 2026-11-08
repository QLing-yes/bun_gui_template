import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router"

import "./index.scss"
import { AppBoot } from "@/components/app-boot.tsx"
import { WindowBootstrap } from "@/components/layout/window-bootstrap.tsx"
import { StorageStatusToast } from "@/components/storage-status-toast.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { Toaster, toast } from "@/components/ui/toast.tsx"
import { TooltipProvider } from "@/components/ui/tooltip.tsx"
import { mountLayerInspector } from "@/dev/layer-inspector.ts"
import { readText, writeText } from "@/lib/storage"
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
    {/* 启动闸门：IndexedDB 装载 + store 水合完成后才渲染，期间显示整页骨架 */}
    <AppBoot>
      {(boot) => (
        <ThemeProvider initialTheme={boot.theme}>
          {/* 提示浮层出口：main 挂一次，登录页与主壳共用（避免两处各包一层 provider） */}
          <TooltipProvider>
            <RouterProvider router={router} />
            {/* 全局提示出口（toast manager 由 ui/toast 单例提供） */}
            <Toaster />
            {/* 运行期落库失败提示：非阻塞轻提示，重试成功后自动收起 */}
            <StorageStatusToast />
            {/* 圆角通道 + 窗口出场时机：登录页与主壳共用一份（启动阶段窗口保持最小化） */}
            <WindowBootstrap />
          </TooltipProvider>
        </ThemeProvider>
      )}
    </AppBoot>
  </StrictMode>
)

// 层级背景检视：零依赖原生工具，仅 dev 挂载；位置存档经持久化门面异步读写
if (import.meta.env.DEV) {
  void mountLayerInspector({ read: readText, write: writeText })
}
