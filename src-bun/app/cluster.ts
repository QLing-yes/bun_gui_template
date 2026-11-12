import os from "node:os";
import { spawn } from "bun";
import { ENV } from "@/config/env";
import { sidecarEnv, watchParentExit } from "./common/tauri_sidecar";

const port = ENV.PORT;
/** worker 入口与当前文件同目录：源码运行为 index.ts，打包产物为 index.js */
const workerEntry = `${import.meta.dir}/index${import.meta.path.endsWith(".ts") ? ".ts" : ".js"}`;

(async () => {
  // 集群模式未启用，直接加载应用入口（单进程）
  if (!ENV.CLUSTER_ENABLED) {
    console.info(`server ${process.pid} http://localhost:${port}/openapi`);
    await import("./index");
    return;
  }

  // 单机多进程集群模式 (Linux 下利用 SO_REUSEPORT)
  // https://elysiajs.com/patterns/deploy.html#cluster-mode
  // https://bun.sh/guides/http/cluster

  const workersCount = Math.max(
    1,
    Math.min(
      ENV.CLUSTER_WORKERS ?? os.availableParallelism(),
      os.availableParallelism(),
    ),
  );

  console.info(
    `[cluster] Starting ${workersCount} workers on port reuse mode...`,
  );

  const workers = new Array(workersCount);
  let isShuttingDown = false;

  const startWorker = (index: number) => {
    const worker = spawn({
      // 复用当前运行时：随包 bun 启动时 execPath 即包内 bun，dev 下即系统 bun，均不依赖 PATH
      cmd: [process.execPath, workerEntry],
      // worker 的探活对象是本进程：凭证里的 pid 改为集群父进程，宿主退出后 worker 仍能跟着收尾
      env: { ...process.env, ...sidecarEnv() },
      stdout: "inherit",
      stderr: "inherit",
      stdin: "inherit",
    });

    workers[index] = worker;

    worker.exited.then((code: number) => {
      // 避免在主进程正在退出，或者子进程正常退出时触发重启
      if (!isShuttingDown && code !== 0) {
        console.error(
          `[cluster] worker ${index} exited with code ${code}, restarting...`,
        );
        // 延迟一秒重启，防止崩溃死循环
        setTimeout(() => {
          startWorker(index);
        }, 1000);
      }
    });
  };

  for (let i = 0; i < workersCount; i++) {
    startWorker(i);
  }

  const shutdown = (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.info(`[cluster] ${signal} received, shutting down…`);
    for (const worker of workers) {
      if (worker) worker.kill();
    }
    process.exitCode = 0;
  };

  // 收到终止信号：杀掉 worker 后必须显式退出——桌面模式下 stdin 监听会让事件循环常驻
  const stop = (signal: string) => {
    shutdown(signal);
    process.exit(0);
  };

  process.on("SIGINT", () => stop("SIGINT"));
  process.on("SIGTERM", () => stop("SIGTERM"));
  process.on("exit", () => shutdown("exit"));

  // 桌面本地服务模式：宿主退出后本进程收不到信号，主动停掉 worker 避免留下孤儿进程
  watchParentExit(() => {
    shutdown("parent exited");
    // stdin 监听会让事件循环常驻，收尾后必须显式退出
    process.exit(0);
  });
})();
