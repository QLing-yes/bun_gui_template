// 圆角通道：唯一发布者。四角半径合成一组值写到文档根 `--app-radius`，供全树继承（同宽度通道）；
// 形状与裁切由 index.scss 的 `html, body{border-radius+overflow:hidden}` 消费，本模块只出值、不挂标记。
// 两层盒重合（body 无 margin）才允许同时画圆角——原点不同的两层（如壳根）相交会把不到 1px 的
// 框偏差放大成逐角递减的弧，那种情况只能留一层。桌面与 web 同一套值，只有最大化归零。

import type { WindowCorners } from "@/store/ui"

/** 四角半径 CSS 变量名 */
const RADIUS_VAR = "--app-radius"

/** 把四角半径写入文档根
 * @param corners 四角半径 @param maximized 窗口是否最大化（归零，否则圆角处漏桌面） */
export function publishRadius(
  corners: WindowCorners,
  maximized: boolean
): void {
  document.documentElement.style.setProperty(
    RADIUS_VAR,
    maximized
      ? "0"
      : `${corners.topLeft}px ${corners.topRight}px ${corners.bottomRight}px ${corners.bottomLeft}px`
  )
}
