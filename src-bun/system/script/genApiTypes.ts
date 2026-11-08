import { mkdir, rm, writeFile } from "node:fs/promises";
import { constants as os_constants, setPriority } from "node:os";
import { join } from "node:path";

const root = process.cwd(); // src-bun
/** 临时 tsc 配置（生成后删除） */
const config_file = join(root, ".tsconfig.gen-api.tmp.json");
/** 声明生成入口（类型树从此文件的可达图镜像输出） */
const entry = "app/index.ts";

/** 单轮 gen 的进行状态 */
type GenState = { timer: ReturnType<typeof setTimeout> | null; abort: AbortController | null };

/** 各输出目录的进行中 gen（按 outDir 区分同一轮：同目录新触发终止上一轮，始终只跑最新） */
const gen_states = new Map<string, GenState>();

/** 生成 API 类型树（d.ts 镜像）：清旧产物 → 写临时配置 → tsc 声明生成 → 清理临时配置
 * @param outDir 类型树输出目录（相对本服务根目录）
 * @param signal 终止信号（新触发终止上一轮时，被终止轮抛错）
 * @throws 产物缺失或被终止时抛错
 */
export default async function genApiTypes(outDir: string, signal?: AbortSignal) {
  const begin = performance.now();
  console.log("\n\x1b[33m🔄 [gen-api] 生成 API 类型树...\x1b[0m");

  // outDir 归一化为绝对路径（Bun rm 在 Windows 不接受 .. 相对路径）
  const out_dir = join(root, outDir);
  await rm(out_dir, { recursive: true, force: true });
  await mkdir(out_dir, { recursive: true });
  await writeFile(config_file, JSON.stringify(gen_tsconfig(out_dir), null, 2));

  try {
    await run_tsc(out_dir, signal);
  } finally {
    await rm(config_file, { force: true });
  }

  const ms = (performance.now() - begin).toFixed(0);
  console.log(`\x1b[32m✅ [gen-api] 类型树生成完成 → ${out_dir} （${ms} ms）\x1b[0m\n`);
}

/** 生成 API 类型树 便于客户端(eden)用于类型检查和代码提示
 * @param outDir 类型树输出目录（同 {@link genApiTypes}）
 */
export function triggerGenApiTypes(outDir: string) {
  const prev = gen_states.get(outDir);
  if (prev?.timer) clearTimeout(prev.timer);
  prev?.abort?.abort();

  const state: GenState = { timer: null, abort: null };
  gen_states.set(outDir, state);
  state.timer = setTimeout(() => {
    state.timer = null;
    state.abort = new AbortController();
    const { signal } = state.abort;
    genApiTypes(outDir, signal).catch((e) => {
      if (!signal.aborted) console.error(e);
    });
  }, 300);
}

// --------------------------------- 工具 ---------------------------------

/** tsc 声明生成配置：extends 复用 ./tsconfig.json（paths/target 等单一来源），
 * 仅覆盖声明输出相关项——父配置 noEmit:true 无法用 CLI 覆盖，故必须经子配置。
 * 保持完整类型检查（不开 noCheck），声明产物才能携带完整字面量路由类型
 * @param out_dir 类型树输出目录（绝对路径）
 * @returns tsconfig 对象
 */
function gen_tsconfig(out_dir: string) {
  return {
    extends: "./tsconfig.json",
    compilerOptions: {
      noEmit: false,
      incremental: false,
      declaration: true,
      emitDeclarationOnly: true,
      rootDir: ".",
      outDir: out_dir,
    },
    // global.d.ts 提供 $g 全局声明（不在 entry 可达图内，缺了检查会全面报错退化）
    include: [entry, "system/types/global.d.ts"],
  };
}

/** 调用本地 tsc 执行声明生成
 * @param out_dir 类型树输出目录（绝对路径）
 * @param signal 终止信号（触发时杀掉 tsc 子进程）
 * @throws 产物缺失时抛错；被终止时抛错（不判产物、不打日志）
 */
async function run_tsc(out_dir: string, signal?: AbortSignal) {
  const proc = Bun.spawn({
    cmd: ["bun", "x", "tsc", "-p", config_file],
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
    signal,
  });
  // tsc 设为最低进程优先级：不抢占 dev 服务/构建的 CPU（平台不支持时静默跳过）
  try {
    setPriority(proc.pid, os_constants.priority.PRIORITY_LOW);
  } catch {
    // 忽略：优先级设置失败不影响生成
  }
  const [out, err, code] = await Promise.all([
    proc.stdout.text(),
    proc.stderr.text(),
    proc.exited,
  ]);
  if (signal?.aborted) throw new Error("[gen-api] 已被新触发终止");
  if (!(await Bun.file(join(out_dir, "app/index.d.ts")).exists())) {
    console.error(out + err);
    throw new Error(`[gen-api] tsc 未产出声明（退出码 ${code}），生成失败`);
  }
}
