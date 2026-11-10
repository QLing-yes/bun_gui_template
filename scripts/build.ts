import { join } from "node:path";
import fs from "node:fs";
import { pipe_out } from "./spawn.ts";
import { copyTo } from "../src-bun/app/utils/file.ts";

const root = process.cwd();

/** 移动端构建目标（不含 bun、不产出 dist）；缺省为桌面便携产物 */
const mobile = process.argv[2] as "android" | "ios" | undefined;

// --------------------------------- 流程 ---------------------------------

if (mobile !== undefined && mobile !== "android" && mobile !== "ios") {
    console.error(`\x1b[31m❌ 未知构建目标: ${mobile}（可选 android / ios）\x1b[0m`);
    process.exit(1);
}

await check_ipc()

if (mobile) {
    // 移动端：只打包 web 与原生工程，接口全部走远程，不含本地 bun 服务
    await build_web();
    console.log(`\n\x1b[33m🔄 Tauri ${mobile} 构建中...\x1b[0m\n`);
    await build_tauri(`${mobile} build`);
    console.log(`\n\x1b[32m✅ ${mobile} 构建完成\x1b[0m\n`);
    process.exit(0);
}

// 构建前清空产物目录，避免旧文件残留
fs.rmSync(join(root, "dist"), { recursive: true, force: true });

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
/** 调用 Tauri CLI 构建
 * @param sub tauri 子命令：桌面为 `build --no-bundle`，移动端为 `android build` / `ios build`
 */
async function build_tauri(sub = "build --no-bundle") {
    // return build("tauri", `tauri ${sub}`, "")
    const proc = Bun.spawn({
        cmd: `bun run tauri ${sub}`.split(" "),
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
/** 复制发布产物：主程序放 dist 根，运行期 .env、bun 运行时与服务 JS 产物树同在 dist/bun */
async function dist() {
    // Windows 可执行文件带后缀，其余平台为无后缀的同名文件
    const exeName = `aigc${process.platform === "win32" ? ".exe" : ""}`;
    await copyTo({
        target: `${root}/dist`,
        pattern: [`${root}/src-tauri/target/release/${exeName}`],
        preserveDir: false,
    });
    await copyTo({
        target: `${root}/dist/bun`,
        pattern: [`${root}/.env`],
        preserveDir: false,
    });
    copy_bun();
}

/** 复制构建所用的 bun 可执行文件到 dist/bun：产物直接用它启动服务，目标机无需另装 bun
 * 构建脚本本身由 bun 执行，execPath 就是本机实际使用的 bun（符号链接已指向真实文件）
 */
function copy_bun() {
    const dir = join(root, "dist", "bun");
    const target = join(dir, process.platform === "win32" ? "bun.exe" : "bun");
    // JS 产物缺失时也能先建目录，避免这里抛 ENOENT 掩盖真正的构建失败
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(process.execPath, target);
    // POSIX 复制不保留权限位，必须补可执行
    if (process.platform !== "win32") fs.chmodSync(target, 0o755);
    console.log(`\x1b[36m[dist] bun 运行时: ${process.execPath} → ${target}\x1b[0m`);
}
