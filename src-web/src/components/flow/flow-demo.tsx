// React Flow 示例画布：自定义步骤节点 + 连线/缩放/小地图，主题走 colorMode 自动跟随

import {
  addEdge,
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type NodeTypes,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { StepNodeView, type StepNode } from "@/components/flow/step-node"

/** 节点类型注册表（模块级常量，避免每轮重建引用） */
const nodeTypes = { step: StepNodeView } satisfies NodeTypes

/** 初始节点工厂：每次生成全新对象，reset 不受历史拖动/内部写入污染 */
const createNodes = (): StepNode[] => [
  {
    id: "start",
    type: "step",
    position: { x: 60, y: 160 },
    data: { label: "开始", hint: "触发入口" },
  },
  {
    id: "process",
    type: "step",
    position: { x: 280, y: 60 },
    data: { label: "处理", hint: "业务逻辑" },
  },
  {
    id: "branch",
    type: "step",
    position: { x: 280, y: 260 },
    data: { label: "分支", hint: "条件判断" },
  },
  {
    id: "end",
    type: "step",
    position: { x: 520, y: 160 },
    data: { label: "结束", hint: "输出结果" },
  },
]

/** 初始连线工厂：显式句柄 id（in/out），不依赖单句柄隐式解析 */
const createEdges = (): Edge[] => [
  {
    id: "e-start-process",
    source: "start",
    sourceHandle: "out",
    target: "process",
    targetHandle: "in",
    animated: true,
  },
  {
    id: "e-start-branch",
    source: "start",
    sourceHandle: "out",
    target: "branch",
    targetHandle: "in",
  },
  {
    id: "e-branch-end",
    source: "branch",
    sourceHandle: "out",
    target: "end",
    targetHandle: "in",
    markerEnd: { type: MarkerType.ArrowClosed },
  },
]

function FlowCanvas() {
  const { resolvedTheme } = useTheme()
  const [nodes, setNodes, onNodesChange] =
    useNodesState<StepNode>(createNodes())
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(createEdges())
  const { fitView } = useReactFlow()

  /** 连线建立：默认加箭头，演示连线即时生效 */
  const onConnect = (c: Connection) =>
    setEdges((eds) =>
      addEdge({ ...c, markerEnd: { type: MarkerType.ArrowClosed } }, eds)
    )

  /** 恢复初始图并重排视野（setTimeout 提交，不依赖 rAF——隐藏页面 rAF 会冻结） */
  const reset = () => {
    setNodes(createNodes())
    setEdges(createEdges())
    window.setTimeout(() => void fitView(), 0)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="min-w-0 flex-1 text-sm text-muted-foreground">
          React Flow 示例：拖动节点、从右侧圆点拉线连接、滚轮缩放
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0"
          onClick={reset}
        >
          重置
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <ReactFlow
          colorMode={resolvedTheme}
          connectionMode={ConnectionMode.Strict}
          fitView
          nodeTypes={nodeTypes}
          nodes={nodes}
          edges={edges}
          onConnect={onConnect}
          onEdgesChange={onEdgesChange}
          onNodesChange={onNodesChange}
        >
          {/* 主题色全部交给 colorMode：Background/MiniMap 的自定义色会绕过或写坏变量通道 */}
          <Background gap={16} size={1} variant={BackgroundVariant.Dots} />
          <Controls showInteractive={false} />
          <MiniMap pannable />
        </ReactFlow>
      </div>
    </div>
  )
}

export function FlowDemo() {
  return (
    <ReactFlowProvider>
      <FlowCanvas />
    </ReactFlowProvider>
  )
}
