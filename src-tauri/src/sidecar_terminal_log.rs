//! 本地服务终端日志工具：bun 进程原始输出按天追加到 保存目录/年-月-日.log

use std::fs::{self, File, OpenOptions};
use std::io::{Error as IoError, Write};
use std::path::PathBuf;

/// 终端日志写入器：跨天自动切换新文件，失败仅提示一次并在下次写入时重开
pub struct SidecarTerminalLog {
    /// 日志保存目录
    dir: PathBuf,
    /// 当前打开文件的日期 YYYY-MM-DD，未打开为 None
    date: Option<String>,
    /// 追加模式的文件句柄，未打开为 None
    file: Option<File>,
    /// 失败提示是否已输出（进程生命周期内仅一次）
    warned: bool,
}

impl SidecarTerminalLog {
    /// 创建写入器，`dir` 为日志保存目录（不存在则在首次写入时创建）
    pub fn new(dir: PathBuf) -> Self {
        Self { dir, date: None, file: None, warned: false }
    }

    /// 追加一行原始输出（同步写入，调用方保证串行）
    pub fn write(&mut self, line: &str) {
        let date = chrono::Local::now().format("%Y-%m-%d").to_string();
        if self.date.as_deref() != Some(date.as_str()) {
            self.date = None;
            self.file = None;
        }
        if self.file.is_none() {
            match self.open(&date) {
                Ok(file) => (self.date, self.file) = (Some(date), Some(file)),
                Err(e) => return self.warn_once(e),
            }
        }
        let Some(file) = self.file.as_mut() else { return };
        if let Err(e) = file.write_all(format!("{line}\n").as_bytes()) {
            self.date = None;
            self.file = None;
            self.warn_once(e);
        }
    }

    /// 打开 年-月-日.log，目录与文件不存在则创建
    fn open(&self, date: &str) -> Result<File, IoError> {
        fs::create_dir_all(&self.dir)?;
        OpenOptions::new()
            .create(true)
            .append(true)
            .open(self.dir.join(format!("{date}.log")))
    }

    /// 失败提示仅输出一次
    fn warn_once(&mut self, e: IoError) {
        if !self.warned {
            self.warned = true;
            eprintln!("[tauri] 本地服务终端日志写入失败: {e}");
        }
    }
}
