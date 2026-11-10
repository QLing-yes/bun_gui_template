// 内容区分栏的标题栏入口：右栏/底栏收起开关（面板自身不再放入口）
// 状态与布局层共读 store/content-split；图标反映当前状态，提示文案描述下一次点击的效果

import { AppIcon } from "@/components/icons"
import type { AppIconName } from "@/components/icons"
import { cn } from "cn"

import { IconAction } from "@/components/layout/icon-action"
import { toast } from "@/components/ui/toast"
import { comboText, shortcutById } from "@/shortcuts/registry"
import {
  useContentSplitStore,
  type ContentSplitSide,
} from "@/store/content-split"

/** 方位元数据：名称、两种动作提示、图标与快捷键条目 id */
const SIDE_META = {
  right: {
    label: "右侧栏",
    collapseHint: "收起右侧栏",
    expandHint: "展开右侧栏",
    openIcon: "panelRightOpen",
    closeIcon: "panelRightClose",
    shortcutId: "content-split-right",
  },
  bottom: {
    label: "底栏",
    collapseHint: "收起底栏",
    expandHint: "展开底栏",
    openIcon: "panelBottomOpen",
    closeIcon: "panelBottomClose",
    shortcutId: "content-split-bottom",
  },
} satisfies Record<
  ContentSplitSide,
  {
    /** 面板名称 */
    label: string
    /** 展开中时下一次点击的提示 */
    collapseHint: string
    /** 已收起时下一次点击的提示 */
    expandHint: string
    /** 当前展开的图标 */
    openIcon: AppIconName
    /** 当前收起的图标 */
    closeIcon: AppIconName
    /** 快捷键条目 id */
    shortcutId: string
  }
>

/** 取快捷键展示串；条目缺失时返回空串（提示文案不留占位符） @param id 快捷键条目 id @returns 形如「（Ctrl/⌘ + Shift + R）」 */
function shortcutHintOf(id: string): string {
  const combo = shortcutById(id)?.combos[0]
  return combo ? `（${comboText(combo)}）` : ""
}

/** 单个面板开关：自动收起期间置灰并在点击时说明原因 @param props 面板方位 */
function SplitAction({ side }: { side: ContentSplitSide }) {
  const collapsed = useContentSplitStore((s) =>
    side === "right" ? s.rightCollapsed : s.bottomCollapsed
  )
  const auto = useContentSplitStore((s) =>
    side === "right" ? s.autoRight : s.autoBottom
  )
  const toggle = useContentSplitStore((s) => s.toggle)
  const meta = SIDE_META[side]
  /** 生效收起态（用户收起或空间不足） */
  const off = collapsed || auto
  const action = off ? meta.expandHint : meta.collapseHint
  const hint = auto
    ? `窗口空间不足，${meta.label}已自动收起`
    : `${action}${shortcutHintOf(meta.shortcutId)}`
  const icon = off ? meta.closeIcon : meta.openIcon

  /** 自动收起时点击只提示原因，不覆盖用户的展开设置 */
  const handleClick = () => {
    if (auto) {
      if (import.meta.env.DEV) {
        console.debug("[content-split] toggle-blocked", {
          side,
          source: "titlebar",
          reason: "auto-collapsed",
        })
      }
      toast.add({
        title: `${meta.label}暂时收起`,
        description: "窗口空间不足，放大窗口后会自动恢复",
        timeout: 3000,
      })
      return
    }
    toggle(side, "titlebar")
  }

  return (
    <IconAction
      hint={hint}
      variant="ghost"
      button={{
        onClick: handleClick,
        "aria-label": action,
        "aria-pressed": !off,
        "aria-disabled": auto || undefined,
        className: cn(auto && "opacity-50"),
      }}
    >
      <AppIcon name={icon} size={16} />
    </IconAction>
  )
}

/** 标题栏里的内容区分栏开关组：主题切换之后、窗口置顶之前（登录页不挂载） */
export function ContentSplitActions() {
  return (
    <>
      <SplitAction side="bottom" />
      <SplitAction side="right" />
    </>
  )
}
