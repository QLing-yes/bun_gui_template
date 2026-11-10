import { join } from "node:path";
import fs from "node:fs";
import { pipe_out } from "./spawn.ts";
import { copyTo } from "../src-bun/app/utils/file.ts";

const root = process.cwd();

// --------------------------------- 流程 ---------------------------------

// 构建前清空产物目录，避免旧文件残留
fs.rmSync(join(root, "dist"), { recursive: true, force: true });

await check_ipc()
await build_config()
await Promise.all([
    build_web(),
    build_bun()
])
console.log("\n\x1b[33m🔄 Tauri 构建中...\x1b[0m\n");
await build_tauri()
// console.log("\n\x1b[32m✅ Tauri 构建完成\x1b[0m\n");
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
/** 复制发布产物到 dist 目录：主程序、sidecar、运行期 .env 需与主程序同级 */
async function dist() {
    await copyTo({
        target: `${root}/dist`,
        pattern: [
            `${root}/src-tauri/target/release/aigc.exe`,
            `${root}/src-tauri/target/release/bun-service.exe`,
            `${root}/.env`,
        ],
        preserveDir: false,
    });
    for (const p of fs.globSync(`${root}/dist/bun-service-*`)) fs.rmSync(p, { force: true });
}
