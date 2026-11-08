import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

/** Rust 侧真身：#[tauri::command] 定义的函数名 */
function rustCommands(): string[] {
    const src = read("src-tauri/src/commands.rs");
    return [...src.matchAll(/#\[tauri::command\]\s*(?:pub )?fn\s+(\w+)/g)].map(m => m[1]);
}

/** Rust 侧注册：generate_handler! 列表（漏注册=前端 invoke 直接失败） */
function registeredCommands(): string[] {
    const src = read("src-tauri/src/lib.rs");
    const block = src.match(/generate_handler!\[(.*?)\]/s)?.[1] ?? "";
    return [...block.matchAll(/commands::(\w+)/g)].map(m => m[1]).map(s => s.trim());
}

/** Rust 侧 emit 的事件名 */
function rustEvents(): string[] {
    const src = read("src-tauri/src/commands.rs") + read("src-tauri/src/sidecar.rs") + read("src-tauri/src/lib.rs");
    return [...src.matchAll(/emit\(\s*"([^"]+)"/g)].map(m => m[1]);
}

/** TS 侧 IPC 常量表（web 只用这里的名字，不再散写字符串） */
function tsMap(block: string, file: string): string[] {
    const src = read(file);
    const body = src.match(new RegExp(`${block} = \\{.*?\\} as const`, "s"))?.[0];
    if (!body) throw new Error(`未找到 ${block}（src-web/src/lib/tauri/index.ts）`);
    return [...body.matchAll(/:\s*"([^"]+)"/g)].map(m => m[1]);
}

const IPC_FILE = "src-web/src/lib/tauri/index.ts";
const declared = rustCommands();
const registered = registeredCommands();
const tsCommands = tsMap("IPC", IPC_FILE);
const tsEvents = tsMap("IPC_EVENT", IPC_FILE);
const emitted = rustEvents();

/** 收集漂移项：命令/事件三端必须一一对应 */
const problems: string[] = [
    ...registered.filter(c => !declared.includes(c)).map(c => `lib.rs 注册了未定义的命令：${c}`),
    ...declared.filter(c => !registered.includes(c)).map(c => `命令已定义但未注册：${c}`),
    ...declared.filter(c => !tsCommands.includes(c)).map(c => `Rust 命令缺 TS 常量：${c}`),
    ...tsCommands.filter(c => !declared.includes(c)).map(c => `TS 常量指向不存在的命令：${c}`),
    ...emitted.filter(e => !tsEvents.includes(e)).map(e => `Rust emit 事件缺 TS 常量：${e}`),
    ...tsEvents.filter(e => !emitted.includes(e)).map(e => `TS 事件常量无 Rust 出处：${e}`),
];

if (problems.length) {
    console.error(`\x1b[31m❌ IPC 契约漂移（${problems.length} 项）：\n  ${problems.join("\n  ")}\x1b[0m\n`);
    process.exit(1);
}
console.log(`\x1b[32m✅ IPC 契约一致：命令 ${declared.length} 个、事件 ${emitted.length} 个\x1b[0m`);
