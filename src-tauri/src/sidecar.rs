//! 本地 bun 服务进程管理（仅 release 构建；开发模式由 bun 直接启动服务）
//! 启动优先用服务目录内随包的 bun 执行 `cluster.js`（缺失才回落 PATH），退出走服务侧 `/offline/exit` 接口，令牌随两次调用传递

use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use tauri::{Emitter, Manager};

use crate::sidecar_terminal_log::SidecarTerminalLog;
use crate::state::SidecarToken;

/// 启动命令兜底：随包 bun 缺失时回落到环境中已安装的 bun（按 PATH 查找）
const BUN_CMD: &str = "bun";
/// 随包 bun 文件名：构建时由 scripts/build.ts 从本机复制进服务目录
#[cfg(windows)]
const BUN_FILE: &str = "bun.exe";
#[cfg(not(windows))]
const BUN_FILE: &str = "bun";
/// 服务产物子目录（主程序同级）：JS 产物、.env、静态资源集中于此
const SERVICE_DIR: &str = "bun";
/// 本地服务入口（构建产物中的进程管理入口，同目录 index.js 由它按需拉起）
const SERVICE_ENTRY: &str = "cluster.js";
/// 服务退出接口（src-bun 控制器统一校验 x-tauri-token）
const EXIT_PATH: &str = "/offline/exit";
/// 退出通知请求超时
const EXIT_TIMEOUT: Duration = Duration::from_millis(1500);
/// 服务进程存活轮询间隔
const MONITOR_INTERVAL: Duration = Duration::from_millis(300);
/// .env 未配置 PORT 时的默认端口（与根 .env 默认值一致）
const DEFAULT_PORT: u16 = 3000;

/// 主程序所在目录：本地服务产物与之同级分发
fn exe_dir() -> Option<PathBuf> {
    Some(std::env::current_exe().ok()?.parent()?.to_path_buf())
}

/// 本地服务目录：主程序同级的产物子目录，进程 CWD 与 .env 均以此为准
fn service_dir() -> Option<PathBuf> {
    Some(exe_dir()?.join(SERVICE_DIR))
}

/// 服务端口：进程环境优先，其次服务目录 .env（与 bun 运行时自动加载同一份），最后回落默认值
fn service_port(dir: &Path) -> u16 {
    fn read() -> Option<u16> {
        std::env::var("PORT").ok()?.trim().parse().ok()
    }
    read()
        .or_else(|| {
            dotenvy::from_path(dir.join(".env")).ok()?;
            read()
        })
        .unwrap_or(DEFAULT_PORT)
}

/// bun 可执行文件：优先随包副本（构建时从本机复制），缺失才回落 PATH 中的 bun
fn bun_bin(dir: &Path) -> PathBuf {
    let bundled = dir.join(BUN_FILE);
    if bundled.is_file() { bundled } else { PathBuf::from(BUN_CMD) }
}

/// 终端日志目录：服务目录下的 logs/bun_terminal（与 bun 自身日志目录分开）
fn terminal_log_dir(dir: &Path) -> PathBuf {
    dir.join("logs").join("bun_terminal")
}

/// 追加一行终端日志：写入器由输出泵与监控线程共享，锁中毒时放弃写入
fn log_line(log: &Arc<Mutex<SidecarTerminalLog>>, line: &str) {
    if let Ok(mut log) = log.lock() {
        log.write(line);
    }
}

/// 逐行消费子进程输出流并落盘（release 无控制台，原始输出是唯一排障依据）
fn pump_output<R: std::io::Read + Send + 'static>(stream: R, log: Arc<Mutex<SidecarTerminalLog>>) {
    std::thread::spawn(move || {
        for line in BufReader::new(stream).lines().map_while(Result::ok) {
            log_line(&log, &line);
        }
    });
}

/// 启动本地 bun 服务：令牌与宿主进程号经 `TAURI_SIDECAR` 环境变量一并注入
/// 失败仅记录不中断——本地服务不可用时 /api 仍可走远程服务器
pub fn spawn_bun_sidecar(app: &tauri::App) {
    let Some(dir) = service_dir() else {
        eprintln!("[tauri] 无法解析本地服务目录，跳过本地 bun 服务");
        return;
    };
    let entry = dir.join(SERVICE_ENTRY);
    // 终端日志：GUI 无控制台，服务原始输出与生命周期事件统一落盘
    let log = Arc::new(Mutex::new(SidecarTerminalLog::new(terminal_log_dir(&dir))));
    // 产物缺失时直接跳过，避免拉起一个必然报错的 bun 进程
    if !entry.is_file() {
        log_line(&log, &format!("[tauri] 未找到本地服务入口 {}，跳过本地 bun 服务", entry.display()));
        return;
    }
    let token = &app.state::<SidecarToken>().0;
    // 宿主 PID 一并下发：服务侧据此探活，无需依赖进程 ppid 推断
    let pid = std::process::id();

    let mut cmd = Command::new(bun_bin(&dir));
    cmd.arg(&entry)
        .current_dir(&dir)
        .env("TAURI_SIDECAR", format!(r#"{{"token":"{token}","pid":{pid}}}"#))
        // stdin 管道随监控线程持有：Tauri 进程结束时写端被系统关闭，服务侧 watchParentExit 兜底退出
        .stdin(Stdio::piped())
        // 输出改为管道，由 pump_output 逐行写终端日志
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    // GUI 进程拉起控制台程序时默认会弹出黑窗，CREATE_NO_WINDOW 抑制
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000);
    }

    let mut child = match cmd.spawn() {
        Ok(child) => child,
        Err(e) => {
            log_line(&log, &format!("[tauri] bun 服务启动失败，应用继续运行: {e}"));
            return;
        }
    };
    log_line(&log, &format!("[tauri] bun 服务已启动, pid: {}", child.id()));
    // 管道写端必须由监控线程持有到子进程结束：函数返回即丢弃会让服务侧立刻收到 stdin EOF 而误判父进程消失
    let stdin = child.stdin.take();
    if let Some(stdout) = child.stdout.take() {
        pump_output(stdout, log.clone());
    }
    if let Some(stderr) = child.stderr.take() {
        pump_output(stderr, log.clone());
    }
    // 进程确认起来后才发布令牌：此前前端问令牌一律得到空串（非空=可用 才成立）
    app.state::<crate::state::SidecarReady>().set(true);

    let handle = app.app_handle().clone();
    std::thread::spawn(move || {
        let _stdin = stdin;
        loop {
            match child.try_wait() {
                Ok(Some(status)) => {
                    log_line(&log, &format!("[tauri] bun 服务已退出, code: {:?}", status.code()));
                    handle.state::<crate::state::SidecarReady>().set(false);
                    // 通知前端：本地 /offline 能力已失效（emit 失败仅表示无人监听，忽略）
                    let _ = handle.emit("sidecar-terminated", status.code());
                    return;
                }
                Ok(None) => std::thread::sleep(MONITOR_INTERVAL),
                Err(e) => {
                    log_line(&log, &format!("[tauri] bun 服务状态查询失败: {e}"));
                    handle.state::<crate::state::SidecarReady>().set(false);
                    return;
                }
            }
        }
    });
}

/// 通知本地 bun 服务退出：POST /offline/exit，令牌经 `x-tauri-token` 请求头传递
/// 失败不阻断退出——stdin 关闭后服务侧 watchParentExit 仍会兜底
pub fn shutdown_bun_sidecar(app: &tauri::AppHandle) {
    if !app.state::<crate::state::SidecarReady>().is_ready() {
        return;
    }
    let Some(dir) = service_dir() else { return };
    let token = &app.state::<SidecarToken>().0;
    let url = format!("http://127.0.0.1:{}{EXIT_PATH}", service_port(&dir));
    // 宿主进程随后就会退出，监控线程未必来得及记录收尾，这里显式留痕
    let mut log = SidecarTerminalLog::new(terminal_log_dir(&dir));
    match ureq::post(&url)
        .set("x-tauri-token", token.as_str())
        .timeout(EXIT_TIMEOUT)
        .call()
    {
        Ok(_) => log.write("[tauri] 已通知 bun 服务退出"),
        Err(e) => log.write(&format!("[tauri] bun 服务退出通知失败: {e}")),
    }
    app.state::<crate::state::SidecarReady>().set(false);
}
