mod commands;
mod state;
#[cfg(not(debug_assertions))]
mod sidecar;
#[cfg(not(debug_assertions))]
mod sidecar_terminal_log;

use state::{SidecarReady, SidecarToken};
use tauri::Manager;

#[cfg(not(debug_assertions))]
use rand::distr::{Alphanumeric, SampleString};

/// 窗口就位三件套：还原最小化 → 显示 → 取焦（幂等，供就绪信号、二次启动与超时兜底共用）
pub(crate) fn present_window(window: &tauri::WebviewWindow) {
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // sidecar 访问令牌：release 随机生成 48 位，开发模式为空串（服务端随之跳过校验）
    #[cfg(not(debug_assertions))]
    let token = Alphanumeric.sample_string(&mut rand::rng(), 48);
    #[cfg(debug_assertions)]
    let token = String::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        // 恢复窗口大小/位置/最大化状态；排除 VISIBLE——显示时机由前端挂载后控制，避免白屏
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::all()
                        & !tauri_plugin_window_state::StateFlags::VISIBLE,
                )
                .build(),
        )
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // 二次启动：把已有窗口还原到前台并聚焦
            if let Some(window) = app.get_webview_window("main") {
                present_window(&window);
            }
        }))
        .manage(SidecarToken(token))
        .manage(SidecarReady::default())
        .setup(|app| {
            #[cfg(not(debug_assertions))]
            sidecar::spawn_bun_sidecar(app);

            // 启动不占屏：Windows 先最小化（任务栏就位、不上屏），web 就绪后经 reveal_window 还原聚焦；
            // mac/Linux 对未可见窗口做 miniaturize 行为不确定，维持「隐藏到就绪」达到同样效果
            if let Some(window) = app.get_webview_window("main") {
                #[cfg(target_os = "windows")]
                let _ = window.minimize();
                // Windows: 开启 WebView2 非客户区支持（ICoreWebView2Settings9）——
                // -webkit-app-region: drag 区域由系统接管：触摸/鼠标拖窗、双击最大化原生可用
                // （贴靠布局浮层需 web 自绘按钮申报 HTMAXBUTTON，稳定版 WebView2 无此通道，等 WCO 转正）
                #[cfg(target_os = "windows")]
                {
                    // 去除 Win11 对无装饰窗口默认的 1px DWM 边框线（DWMWA_COLOR_NONE），并要
                    // DWMWCP_DONOTROUND 关掉系统那圈约 8px 的圆角裁切——conf 已关 shadow（无 OS 阴影、
                    // 无 tao 顶部非客户区），描边与四角曲线全归 web（半径由个性化设置持久化）
                    if let Ok(hwnd) = window.hwnd() {
                        use windows::Win32::Foundation::HWND;
                        use windows::Win32::Graphics::Dwm::{
                            DWMWA_BORDER_COLOR, DWMWA_WINDOW_CORNER_PREFERENCE,
                            DWMWCP_DONOTROUND, DwmSetWindowAttribute,
                        };
                        const BORDER_NONE: u32 = 0xFFFF_FFFE;
                        let raw = HWND(hwnd.0 as *mut core::ffi::c_void);
                        unsafe {
                            let _ = DwmSetWindowAttribute(
                                raw,
                                DWMWA_BORDER_COLOR,
                                &BORDER_NONE as *const u32 as *const core::ffi::c_void,
                                core::mem::size_of::<u32>() as u32,
                            );
                            let _ = DwmSetWindowAttribute(
                                raw,
                                DWMWA_WINDOW_CORNER_PREFERENCE,
                                &DWMWCP_DONOTROUND as *const _ as *const core::ffi::c_void,
                                core::mem::size_of_val(&DWMWCP_DONOTROUND) as u32,
                            );
                        }
                    }

                    let _ = window.with_webview(|w| unsafe {
                        use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Settings9;
                        use windows::core::Interface;
                        if let Ok(core) = w.controller().CoreWebView2() {
                            if let Ok(settings) = core.Settings() {
                                if let Ok(s9) = settings.cast::<ICoreWebView2Settings9>() {
                                    let _ = s9.SetIsNonClientRegionSupportEnabled(true);
                                }
                            }
                        }
                    });
                }

                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_secs(5));
                    // 前端没交出就绪信号（白屏/卡加载）时兜底上屏
                    let stuck = matches!(window.is_visible(), Ok(false))
                        || matches!(window.is_minimized(), Ok(true));
                    // release 无控制台不打日志：兜底本身自愈，强显成功即恢复
                    if stuck {
                        present_window(&window);
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::sidecar_token,
            commands::reveal_window,
            commands::shell_platform
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
