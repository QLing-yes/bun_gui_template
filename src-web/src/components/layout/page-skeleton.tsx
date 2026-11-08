// 路由懒加载期间的骨架：与页面同用 PageCanvas 衬底，避免切换瞬间只剩空白

import { PAGE_PAD_CLASS } from "@/components/layout/class-names"
import { PageCanvas } from "@/components/layout/page-canvas"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "cn"

/** 通用页面骨架（标题条 + 主块） */
export function PageSkeleton() {
  return (
    <PageCanvas>
      <div className={cn("flex flex-col gap-4", PAGE_PAD_CLASS)}>
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-44 max-w-md rounded-lg" />
      </div>
    </PageCanvas>
  )
}
