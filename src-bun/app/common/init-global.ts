// 这个文件内所导入的文件内（和其子文件）都不能使用 $g ，否则会出现未定义错误。
// 只建议在 路由controller （app/controller） 中使用 $g ，其他文件中不建议使用。

import "@/app/lib/error";
import * as common from "@/app/common";

/** 唯一全局变量（不建议增加更多了） */
(globalThis as unknown as { $g: typeof common }).$g = common;
