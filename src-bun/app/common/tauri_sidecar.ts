/** 桌面宿主运行上下文：解析 Tauri 启动命令注入的凭证 JSON（TAURI_SIDECAR）；开发模式下为空 */
const ctx = JSON.parse(process.env.TAURI_SIDECAR ?? "{}") as {
  token?: string;
  pid?: number;
};

export const config = {
  /** 访问令牌；非空即桌面本地服务模式 */
  token: ctx.token ?? "",
  /** 需要探活的父进程号：宿主随凭证注入，缺失时回落到系统记录的 ppid */
  pid: ctx.pid || process.ppid,
};

/**
 * 生成派生子进程的凭证环境：沿用令牌，探活目标改写为发起 spawn 的进程（集群 worker 用）
 * @param pid 子进程需要探活的父进程号，默认当前进程
 * @returns 可直接展开进 spawn env 的环境变量片段
 */
export function sidecarEnv(pid: number = process.pid): Record<string, string> {
  return { TAURI_SIDECAR: JSON.stringify({ token: config.token, pid }) };
}

/**
 * 监听父进程退出并联动关闭，仅桌面本地服务模式生效（正常退出走宿主调用的 /offline/exit）
 * 探活对象取 config.pid（宿主注入，worker 为集群父进程），不依赖父进程退出后可能失真的 ppid
 * @param onExit 退出回调（可异步，仅执行一次），默认直接退出进程
 */
export function watchParentExit(
  onExit: () => void | Promise<void> = () => process.exit(0),
): void {
  if (!config.token) return;
  const { pid } = config;
  let exited = false;

  function shutdown(reason: string) {
    if (exited) return;
    exited = true;
    console.info(`[sidecar] ${reason}, shutting down...`);
    void onExit();
  }

  // 通道一：stdin 管道随父进程退出被系统关闭，即时触发
  process.stdin.resume().on("end", () => shutdown("parent exited"));

  // 通道二：轮询父进程号兜底（信号 0 仅探测；EPERM 视为存活）
  setInterval(() => {
    try {
      process.kill(pid, 0);
    } catch (err) {
      if ((err as { code?: string })?.code === "EPERM") return;
      shutdown(`parent process ${pid} gone`);
    }
  }, 3000).unref();
}

/** 应用收尾动作（停服等），由入口注册；/offline/exit 与父进程消失共用同一条退出链路 */
let exitHandler: (() => Promise<void>) | undefined;
/** 是否已开始退出：两条触发通道只执行一次 */
let exiting = false;

/**
 * 注册应用收尾动作（仅首个生效）
 * @param handler 停服等收尾逻辑，返回后进程退出
 */
export function onExit(handler: () => Promise<void>): void {
  exitHandler ??= handler;
}

/** 执行应用收尾并结束进程；未注册收尾动作时直接退出 */
export async function exitApp(): Promise<void> {
  if (exiting) return;
  exiting = true;
  try {
    await exitHandler?.();
  } finally {
    process.exit(0);
  }
}
