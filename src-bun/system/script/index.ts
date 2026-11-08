import { watchDir } from "@/app/utils/watch";
import batchExport from "./batchExport";
import { triggerGenApiTypes } from "./genApiTypes";
import autoRoutes from "./routes";

const args = process.argv.slice(2);
const routes_config = {
  fromDir: "app/controller",
  target: "./system/generated/routes.ts",
};
const batch_export_config = {
  root: "app/model",// 文件只能在配置的root目录下，否则会导致重复名称
  suffix: [".mold.ts"],
  out: "./system/generated/schema.ts",
  template: `export { schema as {{name}}_schema } from "{{path}}";`,
};
/** API 类型树输出目录（须在 src-web 内，不入库） */
const gen_api_outDir = "../src-web/types/gen-api";

autoRoutes(routes_config);// 文件路由生成
batchExport(batch_export_config);// 批量导出文件生成
triggerGenApiTypes(gen_api_outDir);// API 类型树生成

if (args[0] === "watch") {
  // 监听路由文件变更（autoRoutes 只在结构变化时重写 routes.ts，控制器内部改动也影响类型，故直接串联 gen）
  watchDir({
    dir: routes_config.fromDir,
    suffix: [".ctrl.ts"],
    onChange() {
      autoRoutes(routes_config);
      triggerGenApiTypes(gen_api_outDir);
    },
  });
  // 监听模型文件变更
  watchDir({
    dir: batch_export_config.root,
    suffix: batch_export_config.suffix,
    onChange() {
      batchExport(batch_export_config);
      triggerGenApiTypes(gen_api_outDir);
    },
  });
  console.log("\x1b[32m 👀 watch auto generate \x1b[0m");
}
