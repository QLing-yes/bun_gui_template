import { mergeDeep } from "../src-bun/utils";
import { writeIfChanged } from "../src-bun/utils/file";
import path from "node:path";

/** Web 开发端口（src-bun 之外按常规直接读取环境变量） */
const VITE_PORT = process.env.VITE_PORT;
if (!VITE_PORT) throw new Error("缺少环境变量：VITE_PORT");

async function build_tauri_conf() {
    console.log("\n\x1b[33m🔄 [tauri.conf.json] 编译中...\x1b[0m\n");
    const filePath = path.join(__dirname, "../src-tauri/tauri.conf.json");
    const tauri_json = (await import(filePath)).default;

    const config = {
        "build": {
            "devUrl": `http://localhost:${VITE_PORT}`,
        },
    }

    const merged = mergeDeep(tauri_json, config);
    // 内容没变就不落盘：避免每次 dev/build 都把 tracked 文件刷成 dirty
    const changed = writeIfChanged(filePath, JSON.stringify(merged, null, 2) + "\n");
    console.log(`\x1b[32m✅ [tauri.conf.json] ${changed ? "已更新" : "无变化"}\x1b[0m\n`);
}

await build_tauri_conf();
