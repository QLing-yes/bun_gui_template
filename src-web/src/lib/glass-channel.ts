// 个性化旋钮通道：唯一发布者。三个量挂在 <html> 上，让画布两层、body Portal 里的悬浮侧栏
// 与 ::view-transition 快照层都继承同一组值（定义在子树内会取不到，同侧栏宽度通道的教训）。

/** 自糊半径 CSS 变量名 */
const BLUR_VAR = "--glass-blur"
/** 内容面填充强度 CSS 变量名（%） */
const FILM_VAR = "--film-a"
/** 衬层背景渐变系数 CSS 变量名（1=开、0=关，两处径向晕染按它整体缩放） */
const WASH_VAR = "--wash-a"

/** 把三个旋钮写入文档根
 * @param blurPx 自糊半径 @param filmPercent 填充强度百分比 @param wash 背景渐变是否开启 */
export function publishGlass(
  blurPx: number,
  filmPercent: number,
  wash: boolean
): void {
  const style = document.documentElement.style
  style.setProperty(BLUR_VAR, `${blurPx}px`)
  style.setProperty(FILM_VAR, String(filmPercent))
  style.setProperty(WASH_VAR, wash ? "1" : "0")
}
