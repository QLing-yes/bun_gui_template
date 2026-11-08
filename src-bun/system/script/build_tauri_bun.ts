import { $ } from "bun";
import { build } from "./build.ts";

await (async function build_bun() {
    // 获取 Rust 平台三元组 (Target Triple)
    const rustcOutput = await $`rustc -vV`.text();
    const hostMatch = rustcOutput.match(/host:\s*(.+)/);
    if (!hostMatch) {
        throw new Error("无法获取 Rust host target triple");
    }
    const rustTarget = hostMatch[1]!.trim();

    // 将 Rust 三元组映射到 Bun 的编译目标
    let bunTarget: Bun.Build.CompileTarget;
    if (rustTarget.includes("windows")) {
        bunTarget = rustTarget.includes("aarch64") ? "bun-windows-arm64" : "bun-windows-x64";
    } else if (rustTarget.includes("darwin")) {
        bunTarget = rustTarget.includes("aarch64") ? "bun-darwin-arm64" : "bun-darwin-x64";
    } else if (rustTarget.includes("linux")) {
        bunTarget = rustTarget.includes("aarch64") ? "bun-linux-arm64" : "bun-linux-x64";
    } else {
        throw new Error(`未知的平台: ${rustTarget}`);
    }

    const fileName = `bun-service-${rustTarget}`;

    await build(bunTarget, undefined, fileName);
})();
