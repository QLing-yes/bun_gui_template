import fs from "node:fs";
import { ENV } from "@/config/env";
import batchExport from "@/utils/generate/batchExport";
import { triggerGenApiTypes } from "@/utils/generate/genApiTypes";
import autoRoutes from "@/utils/generate/routes";
import { watchDir } from "@/utils/watch";

const args = process.argv.slice(2);
/** 生成物根目录（全部派生产物只允许落在该目录内） */
const gen_root = "./runtime/generated";
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
/** API 类型树输出目录（未配置时跳过，避免独立运行写到目录外） */
const gen_api_outDir = ENV.GEN_API_OUT_DIR;

/** 触发 Eden API 类型树生成 */
function genApi() {
  if (!gen_api_outDir) return;
  triggerGenApiTypes(gen_api_outDir);
}

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
if (gen_api_outDir)
  genApi(); // API 类型树生成（未配置输出目录时跳过）
else console.log("\x1b[33m⚠ 未配置 GEN_API_OUT_DIR，跳过 Eden 类型树\x1b[0m");

if (args[0] === "watch") {
  // 监听路由文件变更（autoRoutes 只在结构变化时重写 routes.ts，控制器内部改动也影响类型，故直接串联 gen）
  watchDir({
    dir: routes_watch_config.fromDir,
    suffix: [".ctrl.ts"],
    onChange() {
      autoRoutes(routes_watch_config);
      genApi();
    },
  });
  // 监听模型文件变更
  watchDir({
    dir: model_export_config.root,
    suffix: model_export_config.suffix,
    onChange() {
      batchExport(model_export_config);
      genModelTables();
      genApi();
    },
  });
  console.log("\x1b[32m 👀 watch auto generate \x1b[0m");
}
