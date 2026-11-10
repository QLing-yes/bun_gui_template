// Dev-only 图标光学审计页：全登记键 × 16/24 并排裸眼 parity 检查（路由 DEV 门控，release 摇树移除）
// 入口：dev 环境地址 #/dev/icons；新增图标后在此目检占盒/居中/描边 parity

import { AppIcon, APP_ICON_NAMES, iconTierOf } from "@/components/icons"
import { PAGE_PAD_CLASS } from "@/components/layout/class-names"
import { PageCanvas } from "@/components/layout/page-canvas"
import { cn } from "cn"

/** 审计页：每键一格，16/24 双尺寸并排 + tier 标注 */
export function DevIconsPage() {
  return (
    <PageCanvas>
      <div className={cn("flex flex-col gap-4", PAGE_PAD_CLASS)}>
        <h1 className="text-sm font-medium">
          图标光学审计（{APP_ICON_NAMES.length} 键 × 16/24）
        </h1>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-2">
          {APP_ICON_NAMES.map((name) => (
            <div
              key={name}
              className="flex flex-col items-center gap-2 rounded-lg border border-border p-3"
            >
              <div className="flex items-center gap-4">
                <AppIcon name={name} size={16} />
                <AppIcon name={name} size={24} />
              </div>
              <span className="truncate text-xs text-muted-foreground">
                {name}
              </span>
              <span className="text-xs text-muted-foreground">
                tier {iconTierOf(name)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </PageCanvas>
  )
}