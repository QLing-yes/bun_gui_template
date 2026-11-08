import { cp, rm, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { pipe_out } from "./spawn.ts";

const root = process.cwd();

// --------------------------------- 流程 ---------------------------------

await check_ipc()
await build_config()
await Promise.all([
    build_web(),
    build_bun()
])
console.log("\n\x1b[33m🔄 Tauri 构建中...\x1b[0m\n");
await build_tauri()
console.log("\n\x1b[32m✅ Tauri 构建完成\x1b[0m\n");
await dist();
console.log("\n\x1b[32m✅ 全部构建完成\x1b[0m\n");
process.exit(0);

// --------------------------------- 构建 ---------------------------------

/** IPC 契约漂移检查：Rust 命令/事件与 src-web 常量表不一致即中断构建 */
function check_ipc() {
    return build("ipc", "check:ipc", "")
}
function build_config() {
    return build("config", "scripts/config.ts")
}
function build_web() {
    return build("web", "build", "src-web")
}
function build_bun() {
    return build("bun", "system/script/build_tauri_bun.ts", "src-bun")
}
async function build_tauri() {
    // return build("tauri", "tauri build --no-bundle", "")
    const proc = Bun.spawn({
        cmd: ("bun run tauri build --no-bundle").split(" "),
        cwd: join(root, ""),
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
        env: { ...process.env, NODE_ENV: "production" },
    });
    const code = await proc.exited;
    if (code !== 0) {
        console.error(`\n\x1b[31m❌ [tauri] 构建失败，退出码 ${code}\x1b[0m\n`);
        process.exit(code);
    }
    return code;
}

// --------------------------------- 工具 ---------------------------------

/** 启动子进程执行 build 命令，实时转发输出并等待退出，失败则终止整个流程
 * @param tag 来源标记（输出着色前缀）
 * @param command bun run 执行的命令文本
 * @param cwd 子进程工作目录，默认项目根目录
 * @returns 进程退出代码
 */
async function build(tag: string, command: string, cwd = "") {
    const proc = Bun.spawn({
        cmd: ("bun run " + command).split(" "),
        cwd: join(root, cwd),
        stdin: "inherit",
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, NODE_ENV: "production" },
    });
    pipe_out(proc.stdout, `build_${tag} |`);
    pipe_out(proc.stderr, `build_${tag} |`);
    const code = await proc.exited;
    if (code !== 0) {
        console.error(`\n\x1b[31m❌ [${tag}] 构建失败，退出码 ${code}\x1b[0m\n`);
        process.exit(code);
    }
    return code;
}
/** 清空 dist 目录后并行复制发布产物，缺失项打印警告并跳过
 * @returns 发布完成的 Promise，复制失败时抛出错误
 */
async function dist() {
    /** 发布产物源路径（相对项目根目录） */
    const items = [
        "src-tauri/target/release/AIGC.exe",
        "src-tauri/target/release/bun-service.exe",
        ".env",
        "src-bun/public",
    ];
    const out = join(root, "dist");
    const begin = performance.now();
    console.log(`\n\x1b[33m🔄 [dist] 清理输出目录 ${out}\x1b[0m`);
    await rm(out, { recursive: true, force: true });

    let copied = 0;
    let skipped = 0;
    let bytes = 0;
    await Promise.all(items.map(async (item) => {
        const source = join(root, item);
        const info = await stat(source).catch(() => null); // 源不存在时跳过
        if (!info) {
            skipped++;
            console.warn(`\x1b[33m⚠️ [dist] 源不存在，跳过：${item}\x1b[0m`);
            return;
        }
        const start = performance.now();
        await cp(source, join(out, basename(item)), { recursive: true, force: true });
        copied++;
        bytes += info.isFile() ? info.size : 0;
        const size = info.isFile() ? `，${(info.size / 1024 / 1024).toFixed(1)} MB` : "";
        console.log(`\x1b[32m✅ [dist] ${item} → dist/${basename(item)} （${(performance.now() - start).toFixed(0)} ms${size}）\x1b[0m`);
    }));

    const ms = (performance.now() - begin).toFixed(0);
    console.log(`\x1b[32m✅ [dist] 复制${copied}项，跳过${skipped}项 → ${out} （${ms} ms，${(bytes / 1024 / 1024).toFixed(1)} MB）\x1b[0m\n`);
}
