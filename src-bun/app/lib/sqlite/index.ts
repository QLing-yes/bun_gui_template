import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { logger } from "@/app/lib/logger";
import { ENV } from "@/config/env";

/** 创建 SQLite 连接（AOT 构建期用内存库，避免构建写入文件；WAL + NORMAL + 忙等待降低锁冲突与写延迟） */
function createClient() {
  const path = ENV.IS_AOT ? ":memory:" : ENV.SQLITE_DATABASE_PATH;
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const client = new Database(path, { create: true, strict: true });
  // WAL：读不阻塞写、写不阻塞读，写入吞吐明显更高；缺点是多出 -wal/-shm 伴生文件，且不适合网络盘
  // synchronous=NORMAL：WAL 的推荐档位，应用崩溃不丢已提交事务（断电可能丢最后少量），比 FULL 快很多
  // busy_timeout：写锁冲突时最多等 5s，避免多进程/集群 worker 直接报 SQLITE_BUSY
  // foreign_keys：SQLite 默认关闭，必须每连接显式打开，否则级联删除与引用约束不生效
  // cache_size / temp_store / mmap_size：加大页缓存、临时表放内存、按需内存映射，提升读写性能
  client.run(
    [
      "PRAGMA journal_mode = WAL;",
      "PRAGMA synchronous = NORMAL;",
      "PRAGMA busy_timeout = 5000;",
      "PRAGMA foreign_keys = ON;",
      "PRAGMA cache_size = -32000;",
      "PRAGMA temp_store = MEMORY;",
      "PRAGMA mmap_size = 134217728;",
    ].join(" "),
  );
  // 预编译语句缓存容量（默认 20，提高热 SQL 的编译命中率）
  Database.MAX_QUERY_CACHE_SIZE = 100;
  logger.info(`[sqlite] connected ${path}`);
  return client;
}

/** SQLite 连接 */
export const client = createClient();

export default client;
