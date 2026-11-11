import { dirname, join, resolve } from "node:path";
import { aot } from "elysia/plugin/aot/bun";
import { mergeDeep } from "@/app/utils";
import { copyTo } from "@/app/utils/file";

const root = process.cwd();
/** 应用入口文件绝对路径 */
export const main = join(root, "./app/cluster.ts");
/** AOT 预编译指向文件绝对路径 */
export const aotEntry = join(root, "./app/index.ts");

/**
 * @param config - Bun的构建配置
 * @returns Bun 构建结果 Promise
 */
export async function build(
  config: Partial<Bun.BuildConfig>,
) {
  console.log("\n\x1b[33m🔄 Bun构建中...\x1b[0m\n");

  const op: Bun.BuildConfig = mergeDeep({
    // AOT 预编译：指向真实的 Elysia 实例导出文件
    plugins: [aot(aotEntry)],
    // 入口文件路径：指定应用的启动文件
    entrypoints: [main],
    // 输出模块格式：使用 ES Module 格式
    format: "esm",
    // Source Map 配置：生成链接式源码映射，便于生产环境调试
    sourcemap: "linked",
    // 开启树摇优化，移除未使用的代码
    treeShaking: true,
    // 字节码缓存：启用构建时预编译，可提升 2-4 倍启动速度
    bytecode: true,
    // 单文件编译核心配置
    compile: {
      // 目标平台：指定跨编译的目标操作系统和架构
      // target,
      // 输出文件路径：自定义文件名或使用目标平台名称，Windows 自动添加 .exe
      // outfile,
      // 运行时自动加载 .env 环境变量文件（默认开启）
      autoloadDotenv: true,
      // 运行时自动加载 bunfig.toml 配置文件（默认开启）
      autoloadBunfig: true,
      // 运行时自动加载 tsconfig.json（默认关闭，显式开启）
      autoloadTsconfig: true,
      // 运行时自动加载 package.json（默认关闭，显式开启）
      autoloadPackageJson: true,
    },

    // 代码压缩配置
    minify: {
      // 空白符压缩：移除多余空格、换行、缩进
      whitespace: true,
      // 语法优化：常量折叠、死代码消除、语法等价改写
      syntax: true,
      // 标识符压缩：基于使用频率重命名局部变量为短名称
      identifiers: true,
      // 保留名称：压缩标识符的同时保留函数/类的 .name 属性，便于调试
      keepNames: true,
    },

    // 资源命名规则配置
    naming: {
      // 嵌入资源命名模板：禁用内容哈希，保留原始文件名 [name].[ext]
      asset: "[name].[ext]",
    },

    // 构建时常量注入
    define: {
      // 注入生产环境标识：代码中 process.env.NODE_ENV 会被直接替换为字符串字面量 "production"（必须带引号）
      "process.env.NODE_ENV": '"production"',
    },
  }, config);

  await Bun.build(op);

  /** 编译选项对象：compile 为 true 或目标字符串时没有附加选项 */
  const compileOption = typeof op.compile === "object" ? op.compile : undefined;
  /** 构建输出目录：产物文件所在目录 → outdir → 项目根目录 */
  const target = resolve(
    root,
    compileOption?.outfile ? dirname(compileOption.outfile) : (op.outdir ?? "."),
  );

  await copyTo({
    target,
    // 运行期配置与静态资源：当前可能不存在，存在即随产物分发（glob 无命中时为空操作）
    pattern: [
      `${root}/.env`,
      `${root}/.env.*`,
      `${root}/bunfig.toml`,
      `${root}/tsconfig.json`,
      `${root}/package.json`,
      `${root}/public/**/*`,
    ],
    exclude: ["**/node_modules/**"],
    copyEmptyDir: true,
  })

  console.log(`\x1b[32m✅ Bun构建完成 \x1b[0m\n`);
  process.exit(0);
}
