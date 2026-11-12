import fs from "node:fs";
import path from "node:path";

// ─── 工具函数 ──────────────────────────────────────────────────────────────────

/** 流式写入
 * @param filePath 路径
 * @param flags    文件系统标志，默认为 "w"（写入模式，文件不存在则创建，存在则清空）
 *                https://nodejs.cn/api/fs/file_system_flags.html
 */
export function write(filePath: string, flags = "w"): fs.WriteStream {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  return fs.createWriteStream(filePath, {
    flags,
    mode: 0o666, // 文件权限：所有者可读写，组和其他用户可读写（rw-rw-rw-）
    encoding: "utf8",
  });
}

/** 内容有变更时才写入文件
 * @description 内容一致时跳过写入，避免无意义的 mtime 变化触发 `bun --watch` 重启
 * @param filePath 目标文件路径
 * @param content  完整文件内容
 * @returns 是否实际写入
 */
export function writeIfChanged(filePath: string, content: string): boolean {
  if (
    fs.existsSync(filePath) &&
    fs.readFileSync(filePath, "utf8") === content
  ) {
    return false;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, { encoding: "utf8", mode: 0o666 });
  return true;
}

/** 创建符号链接（junction 类型）
 * @param sourceDir  源文件夹路径（相对于 __dirname）
 * @param symlinkDir 符号链接路径（相对于 __dirname）
 */
export async function mklink_junction(
  sourceDir: string,
  symlinkDir: string,
): Promise<boolean> {
  return new Promise<boolean>((resolve, reject) => {
    const sourceFolder = createDir(path.join(__dirname, sourceDir));
    const symlinkPath = createDir(path.join(__dirname, symlinkDir), true);

    // 直接 symlink，EEXIST 视为成功（链接已存在即满足目标）。
    // 原 fs.access(F_OK) 方案有两个问题：
    //   1. TOCTOU 竞态：access 与 symlink 之间另一进程可能抢先创建链接导致崩溃
    //   2. F_OK 跟随符号链接：悬空链接（目标已删除）会误判为"链接不存在"
    fs.symlink(sourceFolder, symlinkPath, "junction", (err) => {
      if (!err || (err as NodeJS.ErrnoException).code === "EEXIST")
        resolve(true);
      else reject(err);
    });
  });
}

/** 创建目录（已存在则跳过）
 * @param pathStr 目标路径
 * @param dirOnly 是否仅创建父级目录：默认 false
 * @returns 原样返回 pathStr
 */
export function createDir(pathStr: string, dirOnly?: boolean): string {
  fs.mkdirSync(dirOnly ? path.dirname(pathStr) : pathStr, { recursive: true });
  return pathStr;
}

/** 生成文件路径树
 * @param suffix 要匹配的文件名结尾 示例: ['.ext.ts']
 * @param pattern  glob 匹配模式  示例: '*.ts'
 */
export function filePathTree(suffix: string[], pattern: string | string[]) {
  const FilePathList = fs
    .globSync(pattern)
    .map((uri) => uri.replaceAll("\\", "/"));

  type PatternMatchMap = Record<string, number[]>;
  type FileTree = Record<string, PatternMatchMap>;
  const FilePathTree: FileTree = {};

  FilePathList.forEach((uri, uriIndex) => {
    const name = path.basename(uri);
    const dir = path.dirname(uri);

    if (!FilePathTree[dir]) FilePathTree[dir] = {};
    suffix.forEach((key) => {
      if (!name.endsWith(key)) return;
      if (!FilePathTree[dir]![key]) FilePathTree[dir]![key] = [];
      FilePathTree[dir]![key].push(uriIndex);
    });
  });

  return { list: FilePathList, tree: FilePathTree };
}

/** 按 glob 匹配路径
 * @param pattern glob 匹配模式
 * @param exclude glob 排除模式，命中任一即排除，默认不排除
 */
export function globTree(pattern: string | string[], exclude: string[] = []) {
  const list = fs.globSync(pattern, { exclude });
  const tree: Record<string, number[]> = {};
  list.forEach((uri, i) => {
    const dir = path.dirname(uri);
    tree[dir] ??= [];
    tree[dir]?.push(i);
  });
  return {
    /** 全部匹配路径 */
    list,
    /** 按目录分组 → list的下标 */
    tree,
  };
}

/** 按 glob 异步复制文件到目标位置（node fs.cp，自动建父级）
 * @param op 配置
 * @returns 已复制的目标路径列表
 */
export async function copyTo(op: {
  /** 目标目录 */
  target: string;
  /** glob 匹配模式 */
  pattern: string | string[];
  /** glob 排除模式 */
  exclude?: string[];
  /** 是否创建命中的空目录，默认 true（仅 preserveDir 为 true 时生效） */
  copyEmptyDir?: boolean;
  /** 是否保持相对目录结构，默认 true */
  preserveDir?: boolean;
}): Promise<string[]> {
  const { target, pattern, exclude = [], preserveDir = true } = op;
  // 平铺模式没有目录可建，强制不建目录项
  const copyEmptyDir = preserveDir && (op.copyEmptyDir ?? true);
  const root = process.cwd();

  const destList = await Promise.all(
    // withFileTypes 直接拿 Dirent，省掉每个匹配项一次 stat
    fs
      .globSync(pattern, { exclude, withFileTypes: true })
      .map(async (dirent) => {
        const uri = path.join(dirent.parentPath, dirent.name);
        // 保持结构时只接受 cwd 内路径，越界（..）退化为平铺，避免写到 target 之外
        const rel = path.relative(root, uri);
        const dest =
          preserveDir && !rel.startsWith("..")
            ? path.join(target, rel)
            : path.join(target, dirent.name);

        // 目录命中只负责建目录（内容由 glob 命中的文件逐个复制，避免整棵树重复拷贝）
        if (dirent.isDirectory()) {
          if (!copyEmptyDir) return null;
          await fs.promises.mkdir(dest, { recursive: true });
          return dest;
        }

        // 文件交给 cp：自动建父级目录、同名覆盖
        await fs.promises.cp(uri, dest, { force: true });
        return dest;
      }),
  );

  return destList.filter((dest) => dest !== null);
}
