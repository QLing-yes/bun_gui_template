// 流程示例自定义节点：官方 Card 承载标题/副标题 + 左右连接点

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react"

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

/** 步骤节点数据 @property label 标题 @property hint 副标题提示 */
export type StepNodeData = { label: string; hint?: string }
/** 步骤节点类型（注册名 step） */
export type StepNode = Node<StepNodeData, "step">

export function StepNodeView({ data }: NodeProps<StepNode>) {
  return (
    <Card
      data-flow-node
      size="sm"
      /* CardHeader 带 @container 容器查询，宽度不再由内容撑开 → 节点定宽 */
      className="w-40 gap-0 shadow-md transition-shadow hover:shadow-lg"
    >
      <Handle
        id="in"
        type="target"
        position={Position.Left}
        className="!size-2.5 !border-0 !bg-muted-foreground"
      />
      <CardHeader>
        <CardTitle>{data.label}</CardTitle>
        {data.hint && <CardDescription>{data.hint}</CardDescription>}
      </CardHeader>
      <Handle
        id="out"
        type="source"
        position={Position.Right}
        className="!size-2.5 !border-0 !bg-primary"
      />
    </Card>
  )
}
