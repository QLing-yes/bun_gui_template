注意带“！”的规则，必须遵守非常重要。

# 项目

同时支持的平台: web、windows、linux、macos

```
Project/
|── scripts/                  # 脚本目录
|── src-bun/                  # Bun服务模块
|── src-web/                  # web模块
|── src-tauri/                # Tauri模块
|── STRUCTURE.md              # 目录结构索引（见下）
|── .env                      # 配置文件
...
```

请参考各种目录下的 package.json、README.md 确定技术栈。
统一使用 bun 作为包管理器。
node_modules 目录下的内容不能修改。

# AGENTS

每个模块下的 AGENTS.md 文件内容属于规则，只有牵扯到该模块的代码，才需要读取该文件。

# EXPERIENCES.md

根目录 `EXPERIENCES.md` 是经验沉淀文件：记录跨模块"踩过才知道"的结论。
- 动手前先浏览该文件相关分组，避免重复踩坑。
- 维护规则：条目自由增删改，过期即删；保持简短，注重要点；只记 AGENTS 规则覆盖不到、读代码得不到的结论；单条一行、言简意赅。
- 重大排查/试验收尾后，把非显而易见的结论沉淀进去（写清判别信号与修法）；**同一类问题出现过三次以上才新增条目**，首次遇到的偶发坑只写在当轮改动清单里，不入库。

# STRUCTURE.md

根目录 `STRUCTURE.md` 是目录结构索引：全部目录/文件的职责、分区规范、跨模块契约速查。
- 动手前查它快速定位文件与契约两端；不确定某文件归属先读对应条目。
- 维护规则：任何文件增删、移动、目录职责变化，必须同一提交内更新该文件对应条目；一行一条写职责不写实现。

# 全局规则
- 代码准则: 极致性能、高复用性、高可读性、易维护，逻辑嵌套≤3层，分区分块编写;
- 语法规范: 禁用存在变量提升的语法声明属性; 不可变对象用常量;
- 规范: 所有入参、返回值、字段、函数，必须写简单明了的注释，注释不能越界描述;
- 格式: 合理换行，代码精简无冗余，尽量减少代码量达到同样效果（不能使用压缩代码的方式）;
- ！边界职责: 注意模块之间边界职责清晰不要有任何牵扯（包括注释描述），每个模块只能负责自己的功能；
- 验证方式: 禁止自动调用任何浏览器/内嵌网页工具做视觉验证（截图、DOM 探针、脚本注入等，耗时且隐藏 surface 判不出真实渲染）；也无需自动跑构建与 dist 产物核对。改动靠代码审查自查，必要时只跑 lint / `check:ipc` / `cargo check` / grep；要过类型必须用 `bun node_modules/typescript/bin/tsc -b --force`（`tsc --noEmit` 会复用 .tsbuildinfo 整轮跳过、npx tsc 是占位包，两者都会假通过）。运行与视觉效果不等用户实机确认——直接交付并说明改了什么，使用过程中出问题由用户反馈。
- 数据兼容: 用户没明确要求兼容旧数据时，一律不做旧数据兼容——不写迁移、不回填、不抬版本号、不为旧档保留强制回档逻辑；默认值改了就以新默认值为准。
- 数据绑定与触发：尽量多使用 注册表、数据映射、事件监听、元数据携带，这种方式避免繁琐的绑定逻辑。
- ！避免重复造轮子：如果存在行业公认或官方推荐的包，优先使用这些包，而不是自己实现；通用能力必须使用行业公认依赖，禁止手写同类功能；优先标准库 / 官方生态，禁用停更、冷门、有高危漏洞的包。先输出 2 款主流依赖对比 + 选型结论，再给代码。

# 审查/对话
- 全部改动结束后，必须进行一次代码审查所有改动的代码和文件，如此循环反复确保无误（最多3轮还是不能解决，就告诉用户避免耗时费时间）。
- 每次修改后，列清单表，从什么改成了什么，还需要有简单简洁的描述作用。
- 每次有需要向我提问确认的，你先自行判断后自行修改，只有必须确认的留到最后向我提问，最后列出改动完成的清单表。

# 上下文与工具成本
- 禁止读第三方库 `dist` 构建产物：只查 `.d.ts` 的局部签名或官方文档；先用 Grep 定位行号，只读命中附近几行。
- tsc/lint 合并成一次跑；回检只针对改动片段，不整份重读文件。
- 长任务按阶段用 `new_context` 换新窗口，避免旧历史逐轮翻倍重发。
- 大文件不同时塞进会话/recent files（`STORAGE.md`、`AGENTS.md`、`STRUCTURE.md` 等整份注入最贵）；按需 Grep 后读局部。

# ！分发与环境处理

## 桌面系统版本基线：
- Windows：Tauri 2 要求 Win10+；贴靠布局浮层仅 Win11 22000+（Rust 端 `IsWindows11OrGreater` 门控，Win10 保持 webview 自绘按钮行为）；WebView2 Evergreen 自动更新，oklch 颜色与 View Transitions 需 Chromium ≥111，旧运行时主题动画自动降级为直接切换
- macOS：最低 10.15（Tauri 2）；oklch 需 Safari ≥15.4（macOS 12.3+），VT 需 Safari ≥18；更早系统自动走无动画降级路径
- Linux：取决于发行版 webkitgtk；oklch 需 ≥2.38、VT 需较新版本，缺失即降级；透明圆角窗口在部分合成器上表现不一，发布前实机验证

## 分发方式：

1. 桌面版/离线版: 所有内容都在客户端。
2. 桌面版/服务版: bun 同时存在于客户端与服务器端。
3. web版/部署版: web 与 bun 都部署到服务器。

## 环境判断：

### bun中判断：
tauri：src-tauri\src\sidecar.rs 会传递token到 src-bun\app\common\tauri_sidecar.ts 的 config.token，有token则为tauri环境。

### web中判断：
tauri：src-web\src\lib\tauri\index.ts 中的 isTauri 为 true 则为tauri环境。
操作系统：tauri 环境下真源是 Rust 端 shell_platform 命令（std::env::consts::OS 编译期常量，windows/macos/linux/android/ios），lib/tauri 首帧用它校正 isWindowsShell；UA 嗅探只是 invoke 返回前的临时占位。非 tauri（浏览器）只能靠 UA/feature 检测，能力门控优先按特性判断（如 CSS @supports），不要信 UA。

## bun controller 路由按环境区分：

- `/api/...` 不写 sidecar 模式相关逻辑。
- `/offline/...` 仅写 sidecar 模式相关逻辑，需要校验接口接收到的 tauri token 是否匹配 tauri_sidecar.ts -> config.token。
