// 空状态页（两种语义共用同一套 shadcn Empty 结构）：
// - 页面不存在：未知路径兜底
// - 没有访问权限：路由权限声明未通过（菜单点击与直接输入地址都落到这里）
// 路径回显取当前槽的 Location（由路由轨道覆盖为冻结地址）；返回上一页按历史可用性出现

import { useEffect } from "react"
import { useLocation, useNavigate } from "react-router"

import { AppIcon } from "@/components/icons"
import type { AppIconName } from "@/components/icons"
import { FILL_CLASS, PAGE_PAD_CLASS } from "@/components/layout/class-names"
import { PageCanvas } from "@/components/layout/page-canvas"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { useHistoryNav } from "@/hooks/use-history-nav"
import { currentPermissions } from "@/lib/access"
import type { RouteAccess } from "@/lib/access"
import { cn } from "cn"

/** 空状态语义 */
type EmptyStateKind = "not-found" | "forbidden"

/** 空状态页参数 */
type EmptyStatePageProps = {
  /** 语义：页面不存在 / 没有访问权限 */
  kind: EmptyStateKind
  /** 回显的完整地址 */
  path: string
  /** 无权限态的权限声明（缺什么权限） */
  access?: RouteAccess
}

/** 两种语义的标题与图标 */
const EMPTY_COPY: Record<
  "not-found" | "forbidden",
  { title: string; icon: AppIconName }
> = {
  "not-found": { title: "页面不存在", icon: "fileQuestionMark" },
  forbidden: { title: "没有访问权限", icon: "lock" },
}

/**
 * 通用空状态页：图标 + 标题 + 说明（路径/所需权限）+ 返回动作
 * @param props 语义、路径与权限声明
 */
function EmptyStatePage({ kind, path, access }: EmptyStatePageProps) {
  const navigate = useNavigate()
  const { canGoBack } = useHistoryNav()
  const { title, icon } = EMPTY_COPY[kind]

  // 关键位置日志：未知路径命中 / 无权限命中（含判定依据）
  useEffect(() => {
    if (!import.meta.env.DEV) return
    if (kind === "not-found") {
      console.debug("[route] unknown path", { path })
      return
    }
    console.debug("[access] denied page", {
      path,
      permission: access?.permission,
      label: access?.label,
      owned: currentPermissions(),
    })
  }, [kind, path, access])

  return (
    <PageCanvas>
      <div
        className={cn(FILL_CLASS, "flex items-center justify-center", PAGE_PAD_CLASS)}
      >
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AppIcon name={icon} size={24} />
            </EmptyMedia>
            <EmptyTitle>{title}</EmptyTitle>
            <EmptyDescription>
              当前路径{" "}
              <span className="break-all font-mono text-foreground">{path}</span>
              {kind === "not-found"
                ? " 没有对应页面"
                : ` 需要「${access?.label ?? "未知权限"}」权限`}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            {kind === "forbidden" && access?.demo && (
              <p className="max-w-xs text-center text-xs text-muted-foreground">
                演示项：在后端给当前角色的 role_permission 表里插入
                perm_code={access.permission} 后刷新即可放行；
                也可在 routes/registry.ts 移除该路由的 access 声明。
              </p>
            )}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button onClick={() => navigate("/")}>返回新建项目</Button>
              {canGoBack && (
                <Button variant="outline" onClick={() => navigate(-1)}>
                  返回上一页
                </Button>
              )}
            </div>
          </EmptyContent>
        </Empty>
      </div>
    </PageCanvas>
  )
}

/** 未知路径兜底页：hash 路由下未匹配的地址落到这里（外壳内，侧栏/标题栏不变） */
export function NotFoundPage() {
  const location = useLocation()
  const path = location.pathname + location.search + location.hash
  return <EmptyStatePage kind="not-found" path={path} />
}

/**
 * 无权限空状态页：路由声明了所需权限但当前账号不具备时由页面槽渲染
 * @param access 该路由的权限声明（由页面槽从路由表解析后传入）
 */
export function AccessDeniedPage({ access }: { access?: RouteAccess }) {
  const location = useLocation()
  const path = location.pathname + location.search + location.hash
  return <EmptyStatePage kind="forbidden" path={path} access={access} />
}
