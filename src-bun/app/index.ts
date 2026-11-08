import "@/app/common/init-global";
import { Elysia } from "elysia";
import plugins from "@/app/plugins/index.plug";
import { watchParentExit } from "@/app/common/tauri_sidecar";

export const app = new Elysia({
    // 在服务器启动前预编译所有路由，大幅降低首次请求的延迟
    precompile: true,
    // 使用 Bun 原生的静态响应优化，提高纯静态返回值的吞吐量
    nativeStaticResponse: true,
    // 强制严格匹配路径（禁用尾部斜杠容忍），减少路由匹配阶段的正则表达式计算开销
    strictPath: true,
    // 开启 Schema 严格规范化（精确映射机制），清理多余字段，保证数据结构干净
    normalize: true,
    serve: {
        // 跨进程端口复用(仅 Linux 生效)，允许多个进程监听同一端口实现负载均衡
        reusePort: true,
        // 降低空闲连接超时时间（默认30秒），防止无用连接长时间占用内存
        idleTimeout: 15,
    }
}).use(plugins).listen(process.env.PORT!);

// 仅 sidecar 模式下生效：监听直接父进程退出并联动关闭（直系子进程看住 Tauri，cluster worker 看住主进程）
watchParentExit(async () => {
    await app.stop();
    process.exit(0);
});

export type APP = typeof app;
