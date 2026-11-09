// 受限示例演示页：仅当当前账号具备 demo:restricted 时才会被渲染（否则页面槽显示无权限空状态）
// 演示项，正式接入角色/权限体系后删除整条路由声明与对应菜单项

import { useEffect } from "react"

import { PageCard } from "@/components/page-card"
import { useAuthStore } from "@/store/auth"

export function RestrictedDemoPage() {
  const username = useAuthStore((s) => s.username)
  /** 当前占位账号标识（未登录为 guest） */
  const account = username ?? "guest"

  // 关键位置日志：放行分支命中的判定依据
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.debug("[access] demo granted", { account, permission: "demo:restricted" })
    }
  }, [account])

  return (
    <PageCard
      title="受限示例页"
      description="演示：该路由声明了所需权限，当前账号具备该权限，因此能进入本页。"
    >
      <div className="flex flex-col gap-2 text-sm">
        <p>
          所需权限：<code className="font-mono">demo:restricted</code>
        </p>
        <p>
          声明位置：<code className="font-mono">src-web/src/routes/registry.ts</code>{" "}
          中该路由的 <code className="font-mono">access</code> 字段。
        </p>
        <p>
          当前账号：<span className="font-mono text-foreground">{account}</span>{" "}
          （占位来源：<code className="font-mono">src-web/src/lib/access.ts</code>）。
        </p>
        <p className="text-muted-foreground">
          恢复受限：从 PLACEHOLDER_GRANTS 里移除「demo:restricted」（或「*」）后刷新即可；
          正式接入时应把占位表替换成真实角色/权限查询。
        </p>
      </div>
    </PageCard>
  )
}
