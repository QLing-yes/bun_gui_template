// 受限示例演示页：仅当当前账号具备权限编号 99999 时才会被渲染（否则页面槽显示无权限空状态）
// 演示项，正式接入角色/权限体系后删除整条路由声明与对应菜单项

import { useEffect } from "react"

import { PageCard } from "@/components/page-card"
import { useAuthStore } from "@/store/auth"

export function RestrictedDemoPage() {
  const user = useAuthStore((s) => s.user)
  const perms = useAuthStore((s) => s.perms)
  /** 当前账号标识（未登录为 guest） */
  const account = user?.username ?? "guest"

  // 关键位置日志：放行分支命中的判定依据
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.debug("[access] demo granted", { account, permission: 99999, owned: perms })
    }
  }, [account, perms])

  return (
    <PageCard
      title="受限示例页"
      description="演示：该路由声明了所需权限编号，当前账号具备该权限，因此能进入本页。"
    >
      <div className="flex flex-col gap-2 text-sm">
        <p>
          所需权限编号：<code className="font-mono">99999</code>
        </p>
        <p>
          声明位置：<code className="font-mono">src-web/src/routes/registry.ts</code>{" "}
          中该路由的 <code className="font-mono">access</code> 字段。
        </p>
        <p>
          当前账号：<span className="font-mono text-foreground">{account}</span>{" "}
          （权限来源：<code className="font-mono">src-web/src/lib/access.ts</code> 读 auth store 的 perms）。
        </p>
        <p className="text-muted-foreground">
          恢复受限：在后端给当前角色的 role_permission 表里插入 perm_code=99999 后刷新即可；
          正式接入时应按业务分配真实权限编号。
        </p>
      </div>
    </PageCard>
  )
}
