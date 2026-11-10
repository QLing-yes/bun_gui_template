import { join } from "node:path";
import { aot } from "elysia/plugin/aot/bun";
import { aotEntry, build as bunBuild, main } from "./build.ts";

// ── 构建本地服务（仅 JS 产物，不内嵌运行时，由宿主用 bun 命令启动） ──

await (async function build_bun() {
    const root = process.cwd();

    await bunBuild({
        // 双入口：cluster 作为进程管理入口供宿主启动，index 作为 AOT 应用入口与集群 worker 目标
        entrypoints: [main, aotEntry],
        // 输出到主程序同级的 bun 子目录：JS 产物、.env、静态资源集中存放
        outdir: join(root, "../dist/bun"),
        // 开启代码分割：共享模块抽成 chunk，避免 cluster 与 index 各内联一份应用代码
        splitting: true,
        // 打包目标为 bun 运行时（使用 Bun/Node 内置模块）
        target: "bun",
        // JS 包保留了运行时 JIT：AOT 自动 strip 会漏掉运行时才注册的路由（如 OPTIONS），必须显式关闭
        plugins: [aot(aotEntry, { strip: false })],
        // 不编译运行时、不生成字节码：运行依赖目标机安装的 bun
        compile: false,
        bytecode: false,
    });
})();
