// 单卡片演示页骨架：页面画布 + 标准内容页内边距 + 标题/说明/正文三段卡片
// 鉴权测试与受限示例页共用；页面文件只描述卡片里的业务内容，不再各展开一遍外壳

import type { ReactNode } from "react"

import { PAGE_PAD_CLASS } from "@/components/layout/class-names"
import { PageCanvas } from "@/components/layout/page-canvas"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "cn"

/** 单卡片演示页参数 */
type PageCardProps = {
  /** 卡片标题 */
  title: string
  /** 标题下方说明 */
  description: string
  /** 卡片正文（纵向排列、左对齐、元素间距 4） */
  children: ReactNode
}

export function PageCard({ title, description, children }: PageCardProps) {
  return (
    <PageCanvas>
      <div className={cn(PAGE_PAD_CLASS, "leading-loose")}>
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-4">
            {children}
          </CardContent>
        </Card>
      </div>
    </PageCanvas>
  )
}
