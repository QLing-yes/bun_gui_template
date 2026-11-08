// 流程测试页：React Flow 示例入口（画布组件在 components/flow/）；点背景用 React Flow 自带 Background

import { FILL_CLASS } from "@/components/layout/class-names"
import { PageCanvas } from "@/components/layout/page-canvas"
import { FlowDemo } from "@/components/flow/flow-demo"

export function FlowPage() {
  return (
    <PageCanvas>
      <div className={FILL_CLASS}>
        <FlowDemo />
      </div>
    </PageCanvas>
  )
}
