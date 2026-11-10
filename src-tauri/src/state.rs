//! Tauri 托管状态定义

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

/// 本地服务访问令牌，经 IPC 下发给前端，随 HTTP 请求头回传鉴权（IPC 契约名沿用 sidecar_token）
pub struct SidecarToken(pub String);

/// 本地服务就绪标志：进程确认启动成功后才允许把令牌交给前端
#[derive(Clone, Default)]
pub struct SidecarReady(Arc<AtomicBool>);

impl SidecarReady {
    /// 标记就绪状态（仅 release 的本地服务监控线程会调用）
    #[cfg(not(debug_assertions))]
    pub fn set(&self, ready: bool) {
        self.0.store(ready, Ordering::Relaxed);
    }

    /// 当前是否就绪
    pub fn is_ready(&self) -> bool {
        self.0.load(Ordering::Relaxed)
    }
}
