fn main() {
    // 图标编译期嵌进 exe，而 tauri-build 不 watch 图标路径：不补这条改图标不会重新嵌入
    println!("cargo:rerun-if-changed=icons/icon.ico");
    tauri_build::build()
}
