// 快捷键单一来源：条目同时驱动三件事——设置页展示、热键匹配、守卫安装。键位字面量只在这里出现一次

import { isTauri } from "@/lib/tauri"

/** 组合键 @property ctrl 需要 Ctrl（macOS 上即 ⌘） @property shift 需要 Shift @property key KeyboardEvent.key */
export interface Combo {
  ctrl?: boolean
  shift?: boolean
  key: string
}

/** 条目类别：hotkey=有后续动作的热键，block=仅拦截默认行为，gesture=非键盘触发（展示用） */
export type ShortcutKind = "hotkey" | "block" | "gesture"

/** 快捷键条目 @property id 稳定标识（热键行为表按此挂钩） @property kind 类别 @property combos 同义键并列
 *  @property gesture 非键盘触发的展示标签 @property action 效果说明 @property platform 生效端 */
export interface ShortcutEntry {
  id: string
  kind: ShortcutKind
  combos: Combo[]
  gesture?: string
  action: string
  platform: "all" | "desktop"
}

/** 全部快捷键条目；新增热键/拦截必须在此登记（展示与安装同源） */
const shortcutEntries: ShortcutEntry[] = [
  {
    id: "sidebar",
    kind: "hotkey",
    combos: [{ ctrl: true, key: "b" }],
    action: "侧栏 显示→折叠→隐藏 三态循环（移动视口为抽屉开合）",
    platform: "all",
  },
  {
    id: "maximize",
    kind: "hotkey",
    combos: [{ key: "F11" }],
    action: "窗口最大化/还原切换",
    platform: "desktop",
  },
  {
    id: "titlebar-dblclick",
    kind: "gesture",
    combos: [],
    gesture: "双击标题栏",
    action: "最大化/还原（鼠标与触摸均可）",
    platform: "desktop",
  },
  {
    id: "contextmenu",
    kind: "block",
    combos: [],
    gesture: "右键",
    action: "上下文菜单已禁用",
    platform: "desktop",
  },
  {
    id: "refresh",
    kind: "block",
    combos: [{ key: "F5" }, { ctrl: true, key: "r" }],
    action: "页面刷新已禁用",
    platform: "desktop",
  },
]

/** 组合键展示文本 @param c 组合键 @returns 形如 Ctrl/⌘ + Shift + R */
export function comboText(c: Combo): string {
  const parts: string[] = []
  if (c.ctrl) parts.push("Ctrl/⌘")
  if (c.shift) parts.push("Shift")
  parts.push(c.key.length === 1 ? c.key.toUpperCase() : c.key)
  return parts.join(" + ")
}

/** 条目的展示串（设置页 Kbd 内容） @param e 条目 @returns 手势标签或组合键列表 */
export function entryText(e: ShortcutEntry): string {
  return e.gesture ?? e.combos.map(comboText).join(" / ")
}

/** 事件是否命中组合键（key 忽略大小写；ctrl 同时接受 ⌘）
 * @param c 组合键 @param e 键盘事件的关键字段 @returns 是否命中 */
export function comboMatches(
  c: Combo,
  e: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey">
): boolean {
  return (
    e.key.toLowerCase() === c.key.toLowerCase() &&
    e.shiftKey === !!c.shift &&
    (!c.ctrl || e.ctrlKey || e.metaKey)
  )
}

/** 按 id 取当前端生效条目 @param id 条目 id @returns 条目或 undefined */
export function shortcutById(id: string): ShortcutEntry | undefined {
  return effectiveShortcuts().find((e) => e.id === id)
}

/** 当前运行环境实际生效的快捷键清单 @returns 按端过滤后的条目数组 */
export function effectiveShortcuts(): ShortcutEntry[] {
  return shortcutEntries.filter((e) => e.platform === "all" || isTauri)
}
