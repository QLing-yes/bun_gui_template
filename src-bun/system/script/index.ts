import fs from "node:fs";
import { watchDir } from "@/app/utils/watch";
import batchExport from "./batchExport";
import { triggerGenApiTypes } from "./genApiTypes";
import autoRoutes from "./routes";

const args = process.argv.slice(2);
/** 生成物根目录（全部派生产物只允许落在该目录内） */
const gen_root = "./system/generated";
/** 模型派生产物目录 */
const model_root = `${gen_root}/model`;

const routes_watch_config = {
  fromDir: "app/controller",
  target: `${gen_root}/routes.ts`,
};
const model_export_config = {
  root: "app/model",
  suffix: [".mold.ts"],
  out: `${model_root}/schema.ts`,
  template: `export { schema as schema_{{name}} } from "{{path}}";`,
};
/** API 类型树输出目录（须在 src-web 内，不入库） */
const gen_api_outDir = "../src-web/types/gen-api";

/** 按方言目录生成表聚合：新增 app/model/<方言> 目录即自动纳入，无需改本脚本 */
function genModelTables() {
  const dialects = fs
    .readdirSync("app/model", { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  for (const dialect of dialects) {
    batchExport({
      root: `app/model/${dialect}`,
      suffix: [".mold.ts"],
      out: `${model_root}/${dialect}/index.ts`,
      template: `export { table as {{name}} } from "{{path}}";`,
    });
  }
}

autoRoutes(routes_watch_config); // 文件路由生成
batchExport(model_export_config); // schema 注册表生成
genModelTables(); // 表聚合生成
triggerGenApiTypes(gen_api_outDir); // API 类型树生成

if (args[0] === "watch") {
  // 监听路由文件变更（autoRoutes 只在结构变化时重写 routes.ts，控制器内部改动也影响类型，故直接串联 gen）
  watchDir({
    dir: routes_watch_config.fromDir,
    suffix: [".ctrl.ts"],
    onChange() {
      autoRoutes(routes_watch_config);
      triggerGenApiTypes(gen_api_outDir);
    },
  });
  // 监听模型文件变更
  watchDir({
    dir: model_export_config.root,
    suffix: model_export_config.suffix,
    onChange() {
      batchExport(model_export_config);
      genModelTables();
      triggerGenApiTypes(gen_api_outDir);
    },
  });
  console.log("\x1b[32m 👀 watch auto generate \x1b[0m");
}
