/** Sidecar 运行上下文：解析 Tauri 注入的凭证 JSON（TAURI_SIDECAR）；开发模式下为空 */
export const config = {
    /** 访问令牌；非空即 sidecar 模式 */
    token: (JSON.parse(process.env.TAURI_SIDECAR || "{}")?.token ?? "") as string,
};

/**
 * 监听直接父进程退出并联动关闭，仅 sidecar 模式生效
 * @param onExit 退出回调（可异步，仅执行一次），默认直接退出进程
 */
export function watchParentExit(onExit: () => void | Promise<void> = () => process.exit(0)): void {
    if (!config.token) return;
    const ppid = process.ppid;
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
            process.kill(ppid, 0);
        } catch (err) {
            if ((err as { code?: string })?.code === "EPERM") return;
            shutdown(`parent process ${ppid} gone`);
        }
    }, 3000).unref();
}
