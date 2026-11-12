import { SQL } from "bun";
import { inAotBuild } from "elysia";
import { logger } from "@/app/lib/logger";

/** 创建 PostgreSQL 连接池（未配置连接串时只建池，不做连通性校验） */
function createClient() {
  const client = new SQL({
    url: process.env.PG_DATABASE_URL ?? "postgres://localhost:5432/postgres",
    max: Number(process.env.PG_DATABASE_POOL_LIMIT) || 10,
  });
  // AOT 构建期 dry-run 不建立真实连接，仅运行时校验连接
  if (!inAotBuild() && process.env.PG_DATABASE_URL) {
    client
      .unsafe("select 1")
      .then(() => logger.info("[postgresql] connected successfully"))
      .catch((err) => logger.error(`[postgresql] ${err}`));
  }
  return client;
}

/** PostgreSQL 连接池 */
export const client = createClient();

export default client;
