// 侧栏宽度通道：唯一发布者。挂在 <html> 上，使三棵子树（侧栏 provider、壳根画布锚点、
// body Portal 里的 Sheet/悬浮侧栏）都能继承同一个值——变量若定义在 provider 子树内，
// Portal 出的消费者取不到（本轮已两次踩到），故上提到文档根。

/** 展开宽 CSS 变量名 */
export const WIDTH_VAR = "--sidebar-width"
/** 图标折叠宽 CSS 变量名（与 index.scss :root 默认值同源） */
export const ICON_VAR = "--sidebar-width-icon"

/** 展开宽可拖区间下限（px，拖拽钳制与持久化收敛共用同一档） */
export const WIDTH_MIN = 160
/** 展开宽可拖区间上限（px） */
export const WIDTH_MAX = 480

/** 把展开宽写入文档根 @param px 像素宽度 */
export function publishWidth(px: number): void {
  document.documentElement.style.setProperty(WIDTH_VAR, `${px}px`)
}

/** 读取当前生效的展开宽（拖动基准值）
 * @param fallback 变量缺失时的回退值 @returns 像素宽度 */
export function readWidth(fallback: number): number {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(WIDTH_VAR)
    .trim()
  return Number.parseFloat(raw) || fallback
}

/** 钳制并取整到像素 @param next 期望宽度 @param min 下限 @param max 上限 @returns 合法宽度 */
export function nextWidth(next: number, min: number, max: number): number {
  return Math.round(next < min ? min : next > max ? max : next)
}
