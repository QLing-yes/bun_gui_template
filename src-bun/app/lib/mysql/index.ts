import { inAotBuild } from "elysia";
import mysql from "mysql2/promise";
import { logger } from "@/app/lib/logger";
import { ENV } from "@/config/env";

/** 创建 MySQL 连接池并注册事件（AOT 构建期不建连） */
function createClient() {
  const client = mysql.createPool({
    uri: ENV.MYSQL_DATABASE_URL,
    waitForConnections: true,
    connectionLimit: ENV.MYSQL_DATABASE_POOL_LIMIT,
  });
  client.pool.on("error", (err: Error) => {
    logger.error("[mysql] error", err);
  });
  client.on("enqueue", () => {
    logger.warn("[mysql] 请求排队，等待空闲连接");
  });
  // AOT 构建期 dry-run 不建立真实连接，仅运行时校验连接
  if (!inAotBuild()) {
    client
      .getConnection()
      .then((conn) => {
        logger.info("[mysql] connected successfully");
        conn.release();
      })
      .catch((err) => {
        logger.error(`[mysql] ${err}`);
      });
  }
  return client;
}

/** MySQL 连接池 */
export const client = createClient();

export default client;
