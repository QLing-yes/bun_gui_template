import { mergeDeep } from "../src-bun/app/utils";
import { writeIfChanged } from "../src-bun/app/utils/file";
import path from "node:path";

const isProd = process.env.NODE_ENV === "production";

async function build_tauri_conf() {
    console.log("\n\x1b[33m🔄 [tauri.conf.json] 编译中...\x1b[0m\n");
    const filePath = path.join(__dirname, "../src-tauri/tauri.conf.json");
    const tauri_json = (await import(filePath)).default;

    const config = {
        "build": {
            "devUrl": `http://localhost:${process.env.VITE_PORT}`,
        },
        "bundle": {
            // sidecar 二进制仅打包时需要；开发模式由 bun 直接启动服务，不注入
            "externalBin": isProd ? [
                "../src-bun/bun-service"
            ] : []
        }
    }

    const merged = mergeDeep(tauri_json, config);
    // 内容没变就不落盘：避免每次 dev/build 都把 tracked 文件刷成 dirty
    const changed = writeIfChanged(filePath, JSON.stringify(merged, null, 2) + "\n");
    console.log(`\x1b[32m✅ [tauri.conf.json] ${changed ? "已更新" : "无变化"}\x1b[0m\n`);
}

await build_tauri_conf();
