import { exitApp } from "@/app/common/tauri_sidecar";

/** 宿主退出通知：先停服再退出（令牌校验由控制器插件统一完成，随请求头 x-tauri-token 传递） */
export default (app: Ctrl) =>
  app.post("exit", () => {
    // 留出响应回写时间，再走与父进程消失相同的收尾链路（app.stop + 进程退出）
    void Bun.sleep(100).then(exitApp);
    return $g.success(null, "bye");
  });
