// 品牌 logo 统一组件：默认比侧栏普通图标（size-4）大 4px

import { cn } from "cn"

/** 品牌显示名。改名需同步另两处硬写点：`src-web/index.html` 的 `<title>`、`tauri.conf.json` 的 productName/title */
export const BRAND_NAME = "AIGC"

/** 品牌标志图；src-web 内所有 logo 引用均走本组件 */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <img
      src="/logo.svg"
      alt=""
      className={cn("aspect-square size-5 shrink-0", className)}
    />
  )
}
