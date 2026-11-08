/// release 打包自检：externalBin 由 scripts/config.ts 注入，缺失产物=本地服务静默不可用
/// 直接 `tauri build`（跳过脚本）时在此处显式失败，而非带病出包
fn check_sidecar_configured() {
    // cargo build script 用 PROFILE 区分构建模式（值 debug/release），非 webpack 的 RELEASE
    if std::env::var("PROFILE").as_deref() != Ok("release") {
        return;
    }
    let conf = std::fs::read_to_string("tauri.conf.json")
        .expect("读取 tauri.conf.json 失败：请在 src-tauri 目录下构建");
    let json: serde_json::Value =
        serde_json::from_str(&conf).expect("tauri.conf.json 解析失败");
    let sidecar = json["bundle"]["externalBin"]
        .as_array()
        .is_some_and(|bins| bins.iter().any(|b| b.as_str().is_some_and(|s| s.contains("bun-service"))));
    assert!(
        sidecar,
        "release 构建缺少 sidecar externalBin：请先执行 scripts 配置（externalBin=../src-bun/bun-service）或手动写入 tauri.conf.json"
    );
}

fn main() {
    check_sidecar_configured();
    tauri_build::build()
}
