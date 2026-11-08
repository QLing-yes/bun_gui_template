// 外壳与页面共享的 Tailwind 类串（复用类名一律提常量，命名以 Class 结尾供 IDE 补全）
// 只放跨文件重复的类串；单处使用的类串留在原处，避免长成第二套样式系统

/** 页面内容区内边距（普通内容页；chat 全高自滚页不接入） */
export const PAGE_PAD_CLASS = "p-4 sm:p-6"

/** 侧栏折叠成图标态时淡出的标签盒（brand 再追加 w-0/flex-none 收起占位） */
export const SIDEBAR_LABEL_CLASS =
  "grid flex-1 text-left text-sm leading-tight transition-opacity group-data-[collapsible=icon]:opacity-0"

/** 标题栏/登录顶栏的动作簇：no-drag 让内部按钮可点，不参与窗口拖动 */
export const CHROME_GROUP_CLASS =
  "flex items-center gap-0.5 [-webkit-app-region:no-drag]"
