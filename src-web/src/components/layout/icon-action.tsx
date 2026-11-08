// 图标按钮 + 悬停提示：标题栏/侧栏图标动作的统一外壳（chrome 态色、提示固定在按钮下方）

import type { ComponentProps, ReactNode } from "react"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/** IconAction 属性 @param hint 悬停提示文案（描述下一次点击的效果）
 *  @param button 透传给 Button 的属性（onClick/disabled/aria-pressed/className 等）
 *  @param children 图标本体 @returns 带提示的图标按钮 */
export function IconAction({
  hint,
  button,
  children,
}: {
  hint: string
  button?: ComponentProps<typeof Button>
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button variant="chrome" size="icon" {...button} />}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="bottom">{hint}</TooltipContent>
    </Tooltip>
  )
}
