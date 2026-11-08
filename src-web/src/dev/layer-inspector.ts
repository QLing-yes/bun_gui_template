// 层级背景检视器：零依赖单文件（纯 TS + 内联 CSS），可整体拷进任何项目使用。
// 用法：宿主自行加 dev 门并注入异步存储，例如 mountLayerInspector({ read, write })
// 能力：自动扫描绘制层（html、body 恒为最底两层，其余为自带 bg / 背景图 / backdrop-filter /
// box-shadow / outline 的元素），按文档顺序＝绘制顺序编号，默认由内向外逐层 visibility 隐藏
// （先撤最靠前的层，⇄ 切成从 html/body 起；只撤绘制、不动布局）；
// 树形展示 tag + id/class/data-* 标签，点标签即复制成裸词（可直接粘进编辑器搜索），可折叠、可刷新；
// 入口是可拖动吸边的悬浮按钮，点击开合面板，Esc 关闭。

/** 命名前缀：类名/属性/存储键统一带前缀，避免与宿主页面冲突 */
const PREFIX = "dlx"
/** 层序号标记属性 */
const ATTR = `data-${PREFIX}`
/** 检视器自身标记属性（扫描时跳过，样式表里永久豁免） */
const ATTR_UI = `data-${PREFIX}-ui`
/** 悬浮按钮吸边位置存储键 */
const STORE_KEY = `${PREFIX}:pos`
/** 置顶层级，压在宿主所有浮层之上 */
const MAX_Z = 2147483647
/** 距边内缩（px） */
const INSET = 10
/** 判定为点击而非拖动的位移阈值（px） */
const DRAG_SLOP = 4
/** 复制反馈驻留时长（ms） */
const COPY_FLASH = 900

/** 复制结果反馈函数 */
type Flash = (chip: HTMLElement, ok: boolean) => void

/** 一个绘制层 */
interface Layer {
  /** 层元素 */
  el: Element
  /** 绘制来源：bg/img/blur/shadow/outline/base */
  marks: string[]
  /** 最近的上一个登记祖先层下标，-1 表示没有 */
  parent: number
}

/** 悬浮按钮吸边位置 */
interface Pos {
  /** 吸边侧 */
  side: "left" | "right"
  /** 按钮 top（px） */
  y: number
}

/** 宿主注入的异步持久化接口（本文件不直连任何存储，保持零依赖可搬运） */
export type LayerInspectorStorage = {
  /** 异步读取原始字符串 @param key 存储键 */
  read: (key: string) => Promise<string | null>
  /** 异步写入原始字符串 @param key 存储键 @param value 待存值 */
  write: (key: string, value: string) => Promise<void>
}

const CSS = `
.${PREFIX}-btn{position:fixed;z-index:${MAX_Z};width:34px;height:34px;display:grid;place-items:center;
  border:1px solid #334155;border-radius:17px;background:#0f172a;color:#e2e8f0;
  font:13px/1 ui-monospace,monospace;cursor:grab;touch-action:none;user-select:none;
  box-shadow:0 4px 16px rgba(0,0,0,.45);transition:left .18s ease}
.${PREFIX}-btn:active{cursor:grabbing}
.${PREFIX}-panel{position:fixed;z-index:${MAX_Z};width:340px;box-sizing:border-box;max-height:62vh;overflow:auto;
  padding:10px;border:1px solid #334155;border-radius:10px;background:#0f172aeb;color:#e2e8f0;
  font:11px/1.6 ui-monospace,monospace}
.${PREFIX}-head{display:flex;align-items:center;gap:6px}
.${PREFIX}-title{font-weight:700}
.${PREFIX}-count{margin-left:auto;color:#94a3b8}
.${PREFIX}-ico{width:22px;height:22px;padding:0;border:1px solid #334155;border-radius:6px;
  background:#1e293b;color:#e2e8f0;cursor:pointer;font:12px/1 ui-monospace,monospace}
.${PREFIX}-ico:hover{background:#334155}
.${PREFIX}-ico[data-on]{border-color:#38bdf8;background:#0c4a6e;color:#bae6fd}
.${PREFIX}-ctrl{display:flex;align-items:center;gap:8px;margin:8px 0}
.${PREFIX}-ctrl input[type=range]{flex:1;min-width:0;accent-color:#38bdf8}
.${PREFIX}-ctrl input[type=number]{width:56px;padding:2px 4px;border:1px solid #334155;border-radius:6px;
  background:#1e293b;color:#e2e8f0}
.${PREFIX}-hint{color:#94a3b8}
.${PREFIX}-now{color:#94a3b8;margin:6px 0;word-break:break-all}
.${PREFIX}-tree ul{margin:0;padding-left:12px;list-style:none}
.${PREFIX}-tree>ul{padding-left:0}
.${PREFIX}-row{display:flex;flex-wrap:wrap;align-items:center;gap:4px;padding:2px 0}
.${PREFIX}-row[data-off] .${PREFIX}-tag{color:#64748b;text-decoration:line-through}
.${PREFIX}-row[data-off] .${PREFIX}-no{background:#7f1d1d;color:#fecaca}
.${PREFIX}-no{min-width:26px;padding:0 3px;border-radius:4px;background:#1e293b;color:#93c5fd;text-align:right}
.${PREFIX}-tag{color:#e2e8f0;white-space:nowrap}
.${PREFIX}-marks{margin-left:auto;color:#475569;white-space:nowrap}
.${PREFIX}-chips{flex:1 1 100%;display:flex;flex-wrap:wrap;gap:3px;min-width:0}
.${PREFIX}-chip{max-width:100%;padding:0 4px;border:1px solid #1e293b;border-radius:4px;background:#1e293b;
  color:#cbd5e1;font:inherit;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  user-select:all}
.${PREFIX}-chip:hover{border-color:#38bdf8;color:#e0f2fe}
.${PREFIX}-chip[data-ok]{border-color:#22c55e;color:#bbf7d0}
.${PREFIX}-chip[data-ok=fail]{border-color:#ef4444;color:#fecaca}
.${PREFIX}-caret{width:14px;padding:0;border:0;background:none;color:#94a3b8;cursor:pointer;
  font:10px/1 ui-monospace,monospace}
`

/** 折叠记忆（刷新后保持） */
const collapsed = new WeakMap<Element, boolean>()

/** 元素自身的绘制来源；display:none 不算绘制 */
function marksOf(el: Element): string[] {
  const s = getComputedStyle(el)
  if (s.display === "none") {
    return []
  }
  const m: string[] = []
  if (s.backgroundColor && s.backgroundColor !== "rgba(0, 0, 0, 0)")
    m.push("bg")
  if (s.backgroundImage && s.backgroundImage !== "none") m.push("img")
  if (s.backdropFilter && s.backdropFilter !== "none") m.push("blur")
  if (s.boxShadow && s.boxShadow !== "none") m.push("shadow")
  if (s.outlineStyle !== "none" && s.outlineWidth !== "0px") m.push("outline")
  return m
}

/** 重扫绘制层并重新编号：html、body 恒为最底两层（透明也算一层），其余取自带绘制的元素 */
function scanLayers(): Layer[] {
  document.body
    .querySelectorAll(`[${ATTR}]`)
    .forEach((el) => el.removeAttribute(ATTR))
  const layers: Layer[] = []

  /** 收一层：检视器自身跳过；非底层且无绘制来源则不算层 */
  const push = (el: Element): void => {
    if (el.closest(`[${ATTR_UI}]`)) {
      return
    }
    const marks = marksOf(el)
    const base = el === document.documentElement || el === document.body
    if (!marks.length && !base) {
      return
    }
    // 祖先按文档顺序已先标记，回溯取最近父层
    let parent = -1
    for (let p = el.parentElement; p; p = p.parentElement) {
      const hit = p.getAttribute(ATTR)
      if (hit !== null) {
        parent = Number(hit)
        break
      }
    }
    el.setAttribute(ATTR, String(layers.length))
    layers.push({ el, marks: marks.length ? marks : ["base"], parent })
  }

  push(document.documentElement)
  push(document.body)
  document.body.querySelectorAll("*").forEach((el) => push(el))
  return layers
}

/** 该层祖先链里是否有正被隐藏的层 */
function hasHiddenAncestor(
  layers: Layer[],
  index: number,
  off: (i: number) => boolean
): boolean {
  for (let p = layers[index].parent; p >= 0; p = layers[p].parent) {
    if (off(p)) {
      return true
    }
  }
  return false
}

/** 显隐规则：隐藏层写 hidden；可见层只在「被隐藏祖先会继承下来」时补 visible，绝不顶掉宿主自己的 visibility
 * @param off 判定某层是否被隐藏 */
function buildRules(layers: Layer[], off: (index: number) => boolean): string {
  const rows: string[] = []
  layers.forEach((_, i) => {
    if (off(i)) {
      rows.push(`[${ATTR}="${i}"]{visibility:hidden}`)
    } else if (hasHiddenAncestor(layers, i, off)) {
      rows.push(`[${ATTR}="${i}"]{visibility:visible}`)
    }
  })
  rows.push(`[${ATTR_UI}],[${ATTR_UI}] *{visibility:visible!important}`)
  return rows.join("\n")
}

/** 框架自动生成的 id：源码搜不到出处，不进标签（只留 title） */
function isAutoId(id: string): boolean {
  return (
    /^(?:base-ui|radix|headlessui|[-_])/.test(id) ||
    /_r_\w+/i.test(id) ||
    /^[a-f\d]{12,}$/i.test(id)
  )
}

/** 可复制标签：#id、.class、data-* 属性；工具自身标记除外 */
function chipsOf(el: Element): string[] {
  const out: string[] = []
  if (el.id && !isAutoId(el.id)) {
    out.push(`#${el.id}`)
  }
  el.classList.forEach((c) => out.push(`.${c}`))
  for (const name of el.getAttributeNames()) {
    if (!name.startsWith("data-") || name.startsWith(ATTR)) {
      continue
    }
    const value = el.getAttribute(name)
    out.push(value ? `${name}="${value}"` : name)
  }
  return out
}

/** 节点行标题：tag + 全量 id/class（含被过滤的自动 id） */
function titleOf(el: Element): string {
  return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""} ${el.getAttribute("class") ?? ""}`
}

/** 复制文本：优先异步剪贴板，非安全上下文/无权限回落 execCommand */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement("textarea")
    ta.value = text
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0"
    document.body.append(ta)
    ta.select()
    const ok = document.execCommand("copy")
    ta.remove()
    return ok
  }
}

/** 标签 chip：点击复制裸词（去掉 # 与 . 前缀，便于直接 grep） */
function chipNode(text: string, flash: Flash): HTMLButtonElement {
  const btn = document.createElement("button")
  btn.type = "button"
  btn.className = `${PREFIX}-chip`
  btn.textContent = text
  btn.title = "点击复制裸词（可直接粘进编辑器搜索）；剪贴板被拒时框选后 Ctrl+C"
  btn.addEventListener("click", () => {
    void copyText(text.replace(/^[#.]/, "")).then((ok) => flash(btn, ok))
  })
  return btn
}

/** 单层层级行：caret 折叠 + 层号 + tag + 绘制来源 + 可复制标签（子层已备好） */
function layerNode(
  layer: Layer,
  index: number,
  kids: HTMLElement[],
  depth: number,
  flash: Flash
): HTMLElement {
  const sub = document.createElement("ul")
  sub.append(...kids)
  if (kids.length && !collapsed.has(layer.el)) {
    collapsed.set(layer.el, depth > 1)
  }
  const isCollapsed = collapsed.get(layer.el) === true

  const li = document.createElement("li")
  const row = document.createElement("div")
  row.className = `${PREFIX}-row`
  row.dataset.index = String(index)
  row.title = titleOf(layer.el)

  const caret = document.createElement("button")
  caret.type = "button"
  caret.className = `${PREFIX}-caret`
  if (!kids.length) {
    caret.hidden = true
  } else {
    caret.textContent = isCollapsed ? "▸" : "▾"
    sub.style.display = isCollapsed ? "none" : ""
    caret.addEventListener("click", () => {
      const next = !collapsed.get(layer.el)
      collapsed.set(layer.el, next)
      caret.textContent = next ? "▸" : "▾"
      sub.style.display = next ? "none" : ""
    })
  }

  const no = document.createElement("span")
  no.className = `${PREFIX}-no`
  no.textContent = `#${index}`

  const tag = document.createElement("span")
  tag.className = `${PREFIX}-tag`
  tag.textContent = layer.el.tagName.toLowerCase()

  const marks = document.createElement("span")
  marks.className = `${PREFIX}-marks`
  marks.textContent = layer.marks.join(" ")

  const chips = document.createElement("span")
  chips.className = `${PREFIX}-chips`
  chips.append(...chipsOf(layer.el).map((text) => chipNode(text, flash)))

  row.append(caret, no, tag, marks, chips)
  li.append(row, sub)
  return li
}

/** 依祖先关系组树：父层＝最近的上一个登记层；逆序构建保证父节点创建时子节点已就绪 */
function buildTree(layers: Layer[], flash: Flash): HTMLElement {
  const kids: number[][] = layers.map(() => [])
  const depth: number[] = layers.map(() => 1)
  layers.forEach((l, i) => {
    if (l.parent >= 0) {
      kids[l.parent].push(i)
      depth[i] = depth[l.parent] + 1
    }
  })

  const nodes = new Map<number, HTMLElement>()
  for (let i = layers.length - 1; i >= 0; i--) {
    nodes.set(
      i,
      layerNode(
        layers[i],
        i,
        kids[i].map((k) => nodes.get(k)!),
        depth[i],
        flash
      )
    )
  }

  const root = document.createElement("ul")
  layers.forEach((_, i) => {
    if (layers[i].parent < 0) {
      root.append(nodes.get(i)!)
    }
  })
  const wrap = document.createElement("div")
  wrap.className = `${PREFIX}-tree`
  wrap.append(root)
  return wrap
}

/** 读吸边存档；无存档回落右侧靠上 @param storage 宿主注入的异步存储 @returns 悬浮按钮位置 */
async function readPos(storage: LayerInspectorStorage): Promise<Pos> {
  try {
    const raw = await storage.read(STORE_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Pos
      if (p.side === "left" || p.side === "right") {
        return { side: p.side, y: Number(p.y) || 0 }
      }
    }
  } catch {
    /* 存储不可用即用默认 */
  }
  return { side: "right", y: INSET }
}

/** 存吸边存档（失败静默，不影响本次会话定位） @param storage 宿主注入的异步存储 @param p 按钮位置 */
function savePos(storage: LayerInspectorStorage, p: Pos): void {
  void storage.write(STORE_KEY, JSON.stringify(p)).catch(() => {
    /* 忽略：仅丢持久化 */
  })
}

/**
 * 挂载检视器；重复调用幂等（已挂载则复用）
 * @param storage 宿主注入的异步存储（读取位置存档，本文件不直连存储）
 * @returns 卸载函数
 */
export async function mountLayerInspector(
  storage: LayerInspectorStorage
): Promise<() => void> {
  const alive = document.querySelector<HTMLElement>(`.${PREFIX}-host`)
  if (alive) {
    return () => alive.remove()
  }

  const savedPos = await readPos(storage)

  const host = document.createElement("div")
  host.className = `${PREFIX}-host`
  host.setAttribute(ATTR_UI, "")

  const css = document.createElement("style")
  css.textContent = CSS
  const rules = document.createElement("style")

  const btn = document.createElement("button")
  btn.type = "button"
  btn.className = `${PREFIX}-btn`
  btn.setAttribute(ATTR_UI, "")
  btn.textContent = "▤"
  btn.title = "层级背景检视（可拖动吸边）"

  const panel = document.createElement("div")
  panel.className = `${PREFIX}-panel`
  panel.hidden = true

  const head = document.createElement("div")
  head.className = `${PREFIX}-head`
  const title = document.createElement("span")
  title.className = `${PREFIX}-title`
  title.textContent = "层级背景检视"
  const count = document.createElement("span")
  count.className = `${PREFIX}-count`
  const invert = document.createElement("button")
  invert.type = "button"
  invert.className = `${PREFIX}-ico`
  invert.textContent = "⇄"
  invert.title = "反转隐藏顺序（内→外 / 外→内）"
  const refresh = document.createElement("button")
  refresh.type = "button"
  refresh.className = `${PREFIX}-ico`
  refresh.textContent = "⟳"
  refresh.title = "重新扫描绘制层"
  const close = document.createElement("button")
  close.type = "button"
  close.className = `${PREFIX}-ico`
  close.textContent = "✕"
  close.title = "关闭面板"
  head.append(title, count, invert, refresh, close)

  const ctrl = document.createElement("div")
  ctrl.className = `${PREFIX}-ctrl`
  const range = document.createElement("input")
  range.type = "range"
  range.min = "0"
  range.step = "1"
  const num = document.createElement("input")
  num.type = "number"
  num.min = "0"
  num.step = "1"
  ctrl.append(range, num)

  const hint = document.createElement("div")
  hint.className = `${PREFIX}-hint`

  const now = document.createElement("div")
  now.className = `${PREFIX}-now`

  host.append(css, rules, btn, panel)
  panel.append(head, ctrl, hint, now)
  document.body.append(host)

  let layers: Layer[] = []
  let level = 0
  /** 隐藏方向：默认由内向外（先撤最靠前的层），⇄ 切成由外向内（从 html/body 起） */
  let reversed = true
  let pos = savedPos
  /** 复制反馈定时器，卸载时统一清 */
  const timers = new Set<number>()
  /** 进行中的拖动收尾，卸载时调用 */
  let endDrag: (() => void) | null = null

  const flash: Flash = (chip, ok) => {
    chip.dataset.ok = ok ? "" : "fail"
    const id = window.setTimeout(() => {
      delete chip.dataset.ok
      timers.delete(id)
    }, COPY_FLASH)
    timers.add(id)
  }

  /** 某层当前是否被隐藏 */
  function isOff(index: number): boolean {
    return reversed ? index >= layers.length - level : index < level
  }

  /** 摆位：按钮贴所选侧，面板同侧且始终在视口内 */
  function place(): void {
    pos.y = Math.max(
      INSET,
      Math.min(pos.y, innerHeight - btn.offsetHeight - INSET)
    )
    btn.style.left = `${pos.side === "left" ? INSET : innerWidth - btn.offsetWidth - INSET}px`
    btn.style.right = "auto"
    btn.style.top = `${pos.y}px`
    if (panel.hidden) {
      return
    }
    panel.style.left = `${pos.side === "left" ? INSET : innerWidth - panel.offsetWidth - INSET}px`
    panel.style.right = "auto"
    panel.style.top = `${Math.max(INSET, Math.min(pos.y, innerHeight - panel.offsetHeight - INSET))}px`
  }

  /** 刷新层号显示、显隐规则与树内状态标记 */
  function sync(): void {
    range.max = String(layers.length)
    num.max = String(layers.length)
    range.value = String(level)
    count.textContent = `${level} / ${layers.length}`
    hint.textContent = reversed
      ? `顺序：由内向外（#${layers.length - 1} → #0）· 点标签复制`
      : `顺序：由外向内（#0 → #${layers.length - 1}）· 点标签复制`
    if (reversed) {
      invert.dataset.on = ""
    } else {
      delete invert.dataset.on
    }
    // 边界层：正向取最深仍可见层，反向取最浅仍可见层
    const edge = reversed ? layers.length - 1 - level : level
    now.textContent =
      level >= layers.length
        ? `全部 ${layers.length} 层已隐藏（露出底层与桌面）`
        : `${reversed ? "最浅可见" : "最深可见"} #${edge} ${titleOf(layers[edge].el)}`
    rules.textContent = buildRules(layers, isOff)
    panel.querySelectorAll<HTMLElement>(`.${PREFIX}-row`).forEach((row) => {
      if (isOff(Number(row.dataset.index))) {
        row.dataset.off = ""
      } else {
        delete row.dataset.off
      }
    })
  }

  /** 重扫并重建树（DOM 变了就点它） */
  function rebuild(): void {
    layers = scanLayers()
    level = Math.min(level, layers.length)
    panel.querySelector(`.${PREFIX}-tree`)?.remove()
    panel.append(buildTree(layers, flash))
    sync()
    place()
  }

  /** 开合面板 */
  function toggle(): void {
    panel.hidden = !panel.hidden
    if (!panel.hidden) {
      rebuild()
    }
    place()
  }

  // 拖动用 window 级事件（不依赖 pointer capture，合成事件也能驱动）
  btn.addEventListener("pointerdown", (e) => {
    const start = { x: e.clientX, y: e.clientY }
    const base = btn.getBoundingClientRect()
    const id = e.pointerId
    let moved = false
    btn.style.transition = "none"

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== id) {
        return
      }
      const dx = ev.clientX - start.x
      const dy = ev.clientY - start.y
      moved ||= Math.hypot(dx, dy) > DRAG_SLOP
      if (moved) {
        btn.style.left = `${base.left + dx}px`
        btn.style.top = `${base.top + dy}px`
      }
    }
    function onUp(ev: PointerEvent): void {
      if (ev.pointerId !== id) {
        return
      }
      detach()
      if (moved) {
        const rect = btn.getBoundingClientRect()
        pos = {
          side: rect.left + rect.width / 2 < innerWidth / 2 ? "left" : "right",
          y: rect.top,
        }
        savePos(storage, pos)
      } else {
        toggle()
      }
      place()
    }
    function detach(): void {
      endDrag = null
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
      btn.style.transition = ""
    }
    endDrag = detach
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
  })

  range.addEventListener("input", () => {
    level = Number(range.value)
    num.value = String(level)
    sync()
  })
  // 数字框：放过中间态（清空、逐位输入），仅纯数字才生效；失焦回落当前真值
  num.addEventListener("input", () => {
    const raw = num.value.trim()
    if (!/^\d+$/.test(raw)) {
      return
    }
    level = Math.min(layers.length, Number(raw))
    sync()
  })
  num.addEventListener("change", () => {
    num.value = String(level)
  })
  invert.addEventListener("click", () => {
    reversed = !reversed
    sync()
  })
  refresh.addEventListener("click", rebuild)
  close.addEventListener("click", () => {
    panel.hidden = true
    place()
  })

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" && !panel.hidden) {
      panel.hidden = true
      place()
    }
  }
  window.addEventListener("keydown", onKey)
  window.addEventListener("resize", place)

  place()
  return () => {
    endDrag?.()
    timers.forEach(clearTimeout)
    window.removeEventListener("keydown", onKey)
    window.removeEventListener("resize", place)
    document.body
      .querySelectorAll(`[${ATTR}]`)
      .forEach((el) => el.removeAttribute(ATTR))
    host.remove()
  }
}
