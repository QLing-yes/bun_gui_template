//! 暴露给前端的 IPC 命令

use tauri::Manager;

use crate::state::{SidecarReady, SidecarToken};

/// web 首屏提交后的就绪信号：还原最小化、显示窗口并聚焦（动作实现见 lib.rs `present_window`）
#[tauri::command]
pub fn reveal_window(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        crate::present_window(&window);
    }
}

/// 宿主平台标识（windows/macos/linux/android/ios…），前端据此做能力门控，不依赖 UA 嗅探
#[tauri::command]
pub fn shell_platform() -> &'static str {
    std::env::consts::OS
}

/// 获取 sidecar 访问令牌；开发模式或未就绪返回空串（前端以「非空=可用」为判据）
#[tauri::command]
pub fn sidecar_token(
    state: tauri::State<'_, SidecarToken>,
    ready: tauri::State<'_, SidecarReady>,
) -> String {
    if !ready.is_ready() {
        return String::new();
    }
    state.0.clone()
}
