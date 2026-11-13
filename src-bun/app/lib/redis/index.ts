import { redis as db, RedisClient } from "bun";
import { logger } from "@/app/lib/logger";
import { ENV } from "@/config/env";

/** 创建 Redis 客户端，按配置惰性连接（AOT 构建期不建连） */
function createClient() {
  let redis: RedisClient = db;
  try {
    /** redis客户端 */
    redis = new RedisClient(ENV.REDIS_URL);
    redis.onconnect = () => logger.info("[redis] connected successfully");
    redis.onclose = (err) => logger.error(`[redis] disconnected:${err}`);
    // AOT 构建期 dry-run 不建立真实连接，仅运行时连接
    if (!ENV.IS_AOT && ENV.REDIS_URL) {
      redis
        .connect()
        .catch((error) => logger.error(`[redis] connect error:${error}`));
    }
  } catch (error) {
    logger.error(`[redis]`, error as Error);
  }
  return redis;
}

/** Redis 客户端 */
export const client = createClient();

export default client;
