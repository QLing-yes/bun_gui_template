import { join } from "node:path";
import { pipe_out } from "./spawn.ts";

const root = process.cwd();

// --------------------------------- 流程 ---------------------------------

await build_config()
await Promise.all([dev_bun(), dev_web(), dev_tauri()])

// --------------------------------- 启动函数 ---------------------------------

function build_config() {
    return dev("config", "scripts/config.ts")
}
function dev_bun() {
    return dev("bun", "dev", "src-bun")
}
function dev_web() {
    return dev("web", "dev", "src-web")
}
function dev_tauri() {
    // devtools 是 cargo feature（不是 cfg(debug_assertions) 能选的），仅 dev 开启
    return dev("tauri", "tauri dev --features devtools", "")
}

// --------------------------------- 工具 ---------------------------------

/** 启动子进程执行 dev 命令，实时转发输出并等待退出，失败则终止整个流程
 * @param tag 来源标记（输出着色前缀）
 * @param command bun run 执行的命令文本
 * @param cwd 子进程工作目录，默认项目根目录
 * @returns 进程退出代码
 */
async function dev(tag: string, command: string, cwd = "") {
    const proc = Bun.spawn({
        cmd: ("bun run " + command).split(" "),
        cwd: join(root, cwd),
        stdin: "inherit",
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, NODE_ENV: "development" },
    });
    pipe_out(proc.stdout, `dev_${tag} |`);
    pipe_out(proc.stderr, `dev_${tag} |`);
    const code = await proc.exited;
    if (code !== 0) {
        console.error(`\n\x1b[31m❌ [${tag}] 启动失败，退出码 ${code}\x1b[0m\n`);
        process.exit(code);
    }
    return code;
}
