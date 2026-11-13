import { SQL } from "bun";
import { logger } from "@/app/lib/logger";
import { ENV } from "@/config/env";

/** 创建 PostgreSQL 连接池（未配置连接串时只建池，不做连通性校验） */
function createClient() {
  const client = new SQL({
    url: ENV.PG_DATABASE_URL,
    max: ENV.PG_DATABASE_POOL_LIMIT,
  });
  // AOT 构建期 dry-run 不建立真实连接，仅运行时校验连接
  if (!ENV.IS_AOT && ENV.PG_DATABASE_URL) {
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
