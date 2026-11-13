import "@/app/common/init-global";
import { cors } from "@elysia/cors";
import { openapi } from "@elysia/openapi";
import { staticPlugin } from "@elysia/static";
import { Elysia } from "elysia";
import { PERM_CODE_KEY } from "@/app/common/no_global";
import {
  config,
  exitApp,
  onExit,
  watchParentExit,
} from "@/app/common/tauri_sidecar";
import plugins from "@/app/plugins/index.plug";
import { ENV } from "@/config/env";
import { createDir } from "@/utils/file";

const isUse = <T, R>(is: T, use: () => R) => is ? use() : new Elysia();

// 启动即声明运行信息；AOT 构建期会 dry-run 执行本入口，跳过避免误报（token 非空=由 tauri 宿主拉起，bun 侧唯一的 tauri 判据）
if (!ENV.IS_AOT) {
  console.info(
    `[bun] 环境：${ENV.NODE_ENV}；tauri：${Boolean(config.token)}；当前平台：${process.platform}`,
  );
}

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
  },
})
  // 可选插件：在 plugins 之前注册，不被后续 hook 影响
  .use(isUse(ENV.CORS_ENABLED, () => cors()))
  .use(isUse(ENV.OPENAPI_ENABLED, () => openapi({ scalar: { showExtensions: [PERM_CODE_KEY] } })))
  .use(
    isUse(ENV.STATIC_DIR, () => {
      createDir(ENV.STATIC_DIR!);
      return staticPlugin({ assets: ENV.STATIC_DIR, alwaysStatic: false });
    })
  )
  .use(plugins)
  .listen(ENV.PORT);

// 收尾只做停服：两条退出通道（宿主调 /offline/exit、父进程消失）共用 exitApp 保证只执行一次
onExit(async () => {
  await app.stop();
});

// 仅桌面本地服务模式下生效：监听直接父进程退出并联动关闭（直系子进程看住 Tauri，cluster worker 看住主进程）
watchParentExit(exitApp);

export type APP = typeof app;
