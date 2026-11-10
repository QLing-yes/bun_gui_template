// 设置页：官方 Tabs 分区导航 + 面板；≥768（与侧栏 md 同档）用 shadcn resizable 可拖左右分栏
// 当前分区以 URL 的 `?section=` 为唯一事实（侧栏深链入口靠它）
// 快捷键数据源为 shortcuts/registry（单一来源）

import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import type { ComponentType, ReactNode } from "react"
import { useSearchParams } from "react-router"
import { useDefaultLayout, type LayoutStorage } from "react-resizable-panels"

import { AppIcon } from "@/components/icons"
import type { AppIconName } from "@/components/icons"
import { FILL_CLASS, PAGE_PAD_CLASS } from "@/components/layout/class-names"
import { PageCanvas } from "@/components/layout/page-canvas"
import { ThemeMenu } from "@/components/layout/theme-menu"
import { StaggerReveal } from "@/components/stagger-reveal"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item"
import { Kbd } from "@/components/ui/kbd"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useIsMobile } from "@/hooks/use-mobile"
import { usePersistedValue } from "@/hooks/use-storage"
import { publishGlass } from "@/lib/glass-channel"
import { publishRadius } from "@/lib/radius-channel"
import { SETTINGS_LAYOUT_KEY, STORAGE_KEYS, writeText } from "@/lib/storage"
import { useWindowState } from "@/lib/tauri"
import { effectiveShortcuts, entryText } from "@/shortcuts/registry"
import {
  BLUR_MAX,
  FILM_MAX,
  RADIUS_MAX,
  useUiStore,
  type CornerSide,
} from "@/store/ui"
import { cn } from "cn"

/** 分区 id 联合类型（URL 参数按此白名单校验，新增分区同步加一项） */
type SectionId = "shortcuts" | "personalize"

/** 分区登记项：一个分区的导航、面板与可选标题行动作 */
type SectionRow = {
  /** 分区 id（亦作 URL `?section=` 的合法值） */
  id: SectionId
  /** 导航与标题文案 */
  label: string
  /** 导航图标 */
  icon: AppIconName
  /** 分区内容 */
  Panel: ComponentType
  /** 标题行右侧动作（无则不占位） */
  action?: ComponentType
}

/** 取合法分区 id：URL 参数不可信，缺省或非法一律回落首项 @param value `section` 查询参数 @returns 分区 id */
function sectionIdOf(value: string | null): SectionId {
  return sections.some((sec) => sec.id === value)
    ? (value as SectionId)
    : sections[0].id
}

/** 分区菜单默认/最小/最大宽度（v4 Panel 像素尺寸字符串） */
const NAV_DEFAULT = "176px"
const NAV_MIN = "140px"
const NAV_MAX = "320px"

/** 窗口圆角落行顺序（左上起） */
const cornerRows = [
  { side: "topLeft", label: "左上角" },
  { side: "topRight", label: "右上角" },
  { side: "bottomLeft", label: "左下角" },
  { side: "bottomRight", label: "右下角" },
] as const satisfies ReadonlyArray<{ side: CornerSide; label: string }>

/** 快捷键面板：官方 Item 列表 + Kbd 键位；拦截类条目置灰 */
function ShortcutsPanel() {
  return (
    <ItemGroup className="gap-0">
      {effectiveShortcuts().map((s, i) => (
        <Fragment key={s.id}>
          {i > 0 && <ItemSeparator className="my-0" />}
          <Item size="sm" className="flex-nowrap rounded-none border-0 px-0">
            <ItemContent>
              <ItemTitle
                className={cn(
                  "font-normal",
                  s.kind === "block" && "text-muted-foreground"
                )}
              >
                {s.action}
              </ItemTitle>
            </ItemContent>
            <ItemActions>
              <Kbd className="px-1.5 whitespace-nowrap">{entryText(s)}</Kbd>
            </ItemActions>
          </Item>
        </Fragment>
      ))}
    </ItemGroup>
  )
}

/** 滑杆数值统一取第一手柄（Base UI 的 value 可能是只读数组） */
function first(v: number | readonly number[]): number {
  return Number(Array.isArray(v) ? v[0] : v)
}

/** 设置页一行滑杆：拖动期只更新本地草稿与视觉通道，松手（commit）才写 store
 * - onPreview 拖动期每帧调用，调用方直接改 CSS 通道做即时预览（不触发 store/外壳重渲染）
 * - onCommit 松手或键盘调整结束时调用一次，落 store（再经 lib/storage 防抖写盘） */
function SliderRow({
  id,
  label,
  value,
  unit,
  max,
  hint,
  onPreview,
  onCommit,
}: {
  /** 控件 id */
  id: string
  /** 标题 */
  label: string
  /** 当前值（store 已提交值） */
  value: number
  /** 单位后缀 */
  unit: string
  /** 取值上限（下限恒 0） */
  max: number
  /** 说明文案，省略则不占行 */
  hint?: string
  /** 拖动期预览回调 @param next 新值 */
  onPreview?: (next: number) => void
  /** 提交回调 @param next 新值 */
  onCommit: (next: number) => void
}) {
  /** 本地草稿：拖动期即时反映，松手后与 store 值收敛 */
  const [draft, setDraft] = useState(value)
  /** 上一次外部值：重置/别处修改时把草稿拉回（按 React 的「prop 变化调整 state」模式） */
  const [lastValue, setLastValue] = useState(value)
  if (lastValue !== value) {
    setLastValue(value)
    setDraft(value)
  }
  /** 本轮拖动是否已记过起点日志（只打首帧，避免逐帧刷屏） */
  const dragging = useRef(false)

  /** 拖动中的一格 @param v Base UI 的数组值 */
  const handleChange = (v: number | readonly number[]) => {
    const next = first(v)
    if (import.meta.env.DEV && !dragging.current) {
      dragging.current = true
      console.debug("[settings] drag-start", { id, from: draft })
    }
    setDraft(next)
    onPreview?.(next)
  }

  /** 松手/键盘结束：提交一次 @param v Base UI 的数组值 */
  const handleCommit = (v: number | readonly number[]) => {
    const next = first(v)
    dragging.current = false
    if (import.meta.env.DEV) console.debug("[settings] commit", { id, next })
    setDraft(next)
    onCommit(next)
  }

  return (
    <Field>
      <FieldLabel htmlFor={id}>
        {label}
        <span className="text-muted-foreground tabular-nums">
          {draft}
          {unit}
        </span>
      </FieldLabel>
      <Slider
        id={id}
        value={[draft]}
        min={0}
        max={max}
        step={1}
        onValueChange={handleChange}
        onValueCommitted={handleCommit}
      />
      {hint && <FieldDescription>{hint}</FieldDescription>}
    </Field>
  )
}

/** 个性化面板：明暗三选项 + 内容面磨砂两旋钮 + 背景渐变开关 + 桌面端窗口四角圆角
 * 滑杆拖动期只写 CSS 通道做即时预览，松手才 set store（store 变更才会带动外壳与落盘） */
function PersonalizePanel() {
  const glassBlur = useUiStore((s) => s.glassBlur)
  const setGlassBlur = useUiStore((s) => s.setGlassBlur)
  const glassFilm = useUiStore((s) => s.glassFilm)
  const setGlassFilm = useUiStore((s) => s.setGlassFilm)
  const bgWash = useUiStore((s) => s.bgWash)
  const setBgWash = useUiStore((s) => s.setBgWash)
  const corners = useUiStore((s) => s.corners)
  const setCorner = useUiStore((s) => s.setCorner)
  const { isMaximized } = useWindowState()

  /** 拖动期草稿镜像：预览按它组合，避免一个滑杆拖动时把另一个滑杆的草稿落下 */
  const draft = useRef({ blur: glassBlur, film: glassFilm, corners })
  // store 值变化（松手提交、重置）时回填草稿
  useEffect(() => {
    draft.current = { blur: glassBlur, film: glassFilm, corners }
  }, [glassBlur, glassFilm, corners])

  /** 磨砂即时预览（只写文档根变量，不碰 store） @param next 本次变化的旋钮 */
  const previewGlass = (next: Partial<{ blur: number; film: number }>) => {
    draft.current = { ...draft.current, ...next }
    publishGlass(draft.current.blur, draft.current.film, bgWash)
  }

  /** 单角圆角即时预览（其余角取最近一次草稿/已提交值） @param side 角位 @param px 半径 */
  const previewCorner = (side: CornerSide, px: number) => {
    draft.current.corners = { ...draft.current.corners, [side]: px }
    publishRadius(draft.current.corners, isMaximized)
  }

  return (
    <FieldGroup className="max-w-md gap-6">
      <FieldSet>
        <FieldLegend>明暗模式</FieldLegend>
        <Field>
          {/* 明暗入口：带文案（与标题栏/侧栏同一组件） */}
          <ThemeMenu size="default" iconOnly={false} />
          <FieldDescription>
            跟随系统时按系统偏好实时切换，系统换档本页跟着换
          </FieldDescription>
        </Field>
      </FieldSet>
      <FieldSet>
        <FieldLegend>内容面磨砂</FieldLegend>
        <SliderRow
          id="glass-blur"
          label="模糊程度"
          value={glassBlur}
          unit="px"
          max={BLUR_MAX}
          hint="内容面自身的高斯模糊半径，0 为不糊；糊的是衬层透出的纹理"
          onPreview={(next) => previewGlass({ blur: next })}
          onCommit={setGlassBlur}
        />
        <SliderRow
          id="glass-film"
          label="背景不透明度"
          value={glassFilm}
          unit="%"
          max={FILM_MAX}
          hint="内容面壳色的不透明度；衬层保持实心，100% 即无透出"
          onPreview={(next) => previewGlass({ film: next })}
          onCommit={setGlassFilm}
        />
      </FieldSet>
      <Field orientation="horizontal">
        <FieldLabel htmlFor="bg-wash">背景渐变</FieldLabel>
        <Switch id="bg-wash" checked={bgWash} onCheckedChange={setBgWash} />
      </Field>
      <FieldSet>
        <FieldLegend>窗口圆角</FieldLegend>
        <FieldDescription>
          四角各自半径，0 即直角；最大化时自动归零
        </FieldDescription>
        {cornerRows.map((row) => (
          <SliderRow
            key={row.side}
            id={`radius-${row.side}`}
            label={row.label}
            value={corners[row.side]}
            unit="px"
            max={RADIUS_MAX}
            onPreview={(next) => previewCorner(row.side, next)}
            onCommit={(next) => setCorner(row.side, next)}
          />
        ))}
      </FieldSet>
    </FieldGroup>
  )
}

/** 个性化标题行右侧动作：一次把磨砂与四角圆角回默认档 */
function PersonalizeReset() {
  const resetPersonalize = useUiStore((s) => s.resetPersonalize)

  return (
    <Button size="sm" variant="outline" onClick={resetPersonalize}>
      <AppIcon name="rotateCcw" size={16} />
      重置
    </Button>
  )
}

/** 设置分区清单：导航、面板与标题行动作全部出自此表，新增分区在此登记即可 */
const sections: readonly SectionRow[] = [
  {
    id: "shortcuts",
    label: "快捷键",
    icon: "keyboard",
    Panel: ShortcutsPanel,
  },
  {
    id: "personalize",
    label: "个性化",
    icon: "palette",
    Panel: PersonalizePanel,
    action: PersonalizeReset,
  },
]

/** 单分区面板：标题行（左标题、右动作）+ 分区内容；切分区时两块内容错峰入场 */
function SectionPanel({ sec }: { sec: SectionRow }) {
  const { id, label, Panel, action: Action } = sec

  return (
    <ScrollArea className="h-full">
      <StaggerReveal
        className={cn("flex flex-col gap-4", PAGE_PAD_CLASS)}
        trigger={id}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{label}</h2>
          {Action && <Action />}
        </div>
        <Panel />
      </StaggerReveal>
    </ScrollArea>
  )
}

/** 宽档分栏：布局原文异步装载完成后才挂载，保证 useDefaultLayout 首次读取即为存档值 */
function DesktopSettingsTabs({
  active,
  onPick,
  triggers,
  panels,
  initialLayout,
}: {
  /** 当前分区 */
  active: SectionId
  /** 切换分区 */
  onPick: (value: unknown) => void
  /** 导航触发器集合 */
  triggers: ReactNode
  /** 分区面板集合 */
  panels: ReactNode
  /** 已从 IndexedDB 读出的布局原文 */
  initialLayout: string | null
}) {
  /** 布局原文镜像；react-resizable-panels 只认同步存储，读写仍统一经持久化门面 */
  const rawRef = useRef<string | null>(initialLayout)
  /** 内存存储适配器：读返回已装载原文，写回镜像并异步落库 */
  const storage = useMemo<LayoutStorage>(
    () => ({
      getItem: () => rawRef.current,
      setItem: (_key, value) => {
        rawRef.current = value
        void writeText(SETTINGS_LAYOUT_KEY, value)
      },
    }),
    []
  )
  /** 分栏布局持久化（仅用户拖动才写） */
  const layout = useDefaultLayout({
    id: STORAGE_KEYS.settingsLayout,
    onlySaveAfterUserInteractions: true,
    storage,
  })

  return (
    <PageCanvas>
      <Tabs
        orientation="vertical"
        value={active}
        onValueChange={onPick}
        className={cn(FILL_CLASS, "gap-0")}
      >
        <ResizablePanelGroup
          orientation="horizontal"
          defaultLayout={layout.defaultLayout}
          onLayoutChanged={layout.onLayoutChanged}
          className={FILL_CLASS}
        >
          <ResizablePanel
            id="settings-nav"
            defaultSize={NAV_DEFAULT}
            minSize={NAV_MIN}
            maxSize={NAV_MAX}
          >
            <TabsList
              variant="line"
              className="h-full w-full items-start justify-start p-3"
            >
              {triggers}
            </TabsList>
          </ResizablePanel>
          {/* 手柄线由 index.scss 的 [data-slot=resizable-handle]::before 绘制（CLI 包装不渲染 children） */}
          <ResizableHandle className="cursor-col-resize border-0 bg-transparent" />
          <ResizablePanel id="settings-content" className="min-w-0">
            {panels}
          </ResizablePanel>
        </ResizablePanelGroup>
      </Tabs>
    </PageCanvas>
  )
}

/** 分栏布局读取中的局部区块骨架 */
function SettingsLayoutSkeleton() {
  return (
    <PageCanvas>
      <div className={cn("flex flex-col gap-4", PAGE_PAD_CLASS)}>
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-48 w-full" />
      </div>
    </PageCanvas>
  )
}

/** 分栏布局读取失败：给出原因与重试入口，不静默留空白 */
function SettingsLayoutError({ onRetry }: { onRetry: () => void }) {
  return (
    <PageCanvas>
      <div className={PAGE_PAD_CLASS}>
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>布局读取失败</CardTitle>
            <CardDescription>本地分栏布局暂时无法读取，可重试或继续使用默认宽度。</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={onRetry}>重试</Button>
          </CardContent>
        </Card>
      </div>
    </PageCanvas>
  )
}

export function SettingsPage() {
  /** 分区状态以 URL 查询参数为唯一事实（侧栏可直接 `?section=personalize` 深链进入） */
  const [params, setParams] = useSearchParams()
  /** 当前分区 */
  const active = sectionIdOf(params.get("section"))
  /** 切换分区：replace 改写 URL，不往历史栈灌条目；Tabs 值为弱类型，先收口成 string */
  const pick = (v: unknown) =>
    setParams({ section: String(v) }, { replace: true })
  /** 窄档竖排堆叠、宽档可拖分栏；同一时刻只挂载一个 TabsList，故 Tabs 根不重复 */
  const isMobile = useIsMobile()
  /** 宽档分栏布局原文：异步门面读取，加载态/失败态由钩子状态驱动 */
  const layout = usePersistedValue(SETTINGS_LAYOUT_KEY)

  /** 导航触发器集合（两档布局共用） */
  const triggers = sections.map((sec) => (
    <TabsTrigger
      key={sec.id}
      value={sec.id}
      className="flex-none justify-start"
    >
      <AppIcon name={sec.icon} />
      {sec.label}
    </TabsTrigger>
  ))

  /** 分区面板集合（Base UI 仅挂载激活项） */
  const panels = sections.map((sec) => (
    <TabsContent key={sec.id} value={sec.id} className="h-full min-w-0">
      <SectionPanel sec={sec} />
    </TabsContent>
  ))

  if (isMobile) {
    return (
      <PageCanvas>
        <Tabs
          value={active}
          onValueChange={pick}
          className={cn(FILL_CLASS, "gap-0")}
        >
          <TabsList variant="line" className="justify-start px-3">
            {triggers}
          </TabsList>
          <Separator />
          {panels}
        </Tabs>
      </PageCanvas>
    )
  }

  if (layout.loadStatus === "loading") return <SettingsLayoutSkeleton />
  if (layout.loadStatus === "error") {
    return <SettingsLayoutError onRetry={layout.retry} />
  }

  return (
    <DesktopSettingsTabs
      active={active}
      onPick={pick}
      triggers={triggers}
      panels={panels}
      initialLayout={layout.value}
    />
  )
}
