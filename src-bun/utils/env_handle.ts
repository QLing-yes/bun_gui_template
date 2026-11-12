/**
 * 环境变量通用处理：读取、必填校验与类型转换。
 * 只处理 `process.env` 的读取语义，不包含任何业务配置项；业务配置在 `config/env.ts` 组装。
 */

const raw = process.env;

/**
 * 读取必填字符串，缺失立即抛错
 * @param key 环境变量名
 * @returns 非空字符串值
 */
export function str(key: string): string {
  const value = raw[key];
  if (!value) throw new Error(`[env] 缺少环境变量：${key}`);
  return value;
}

/**
 * 读取可选字符串
 * @param key 环境变量名
 * @returns 有值返回字符串，空值/缺失返回 undefined
 */
export function opt(key: string): string | undefined {
  return raw[key] || undefined;
}

/**
 * 读取布尔开关（.env 写 true 才开启）
 * @param key 环境变量名
 * @returns 是否等于字符串 "true"
 */
export function flag(key: string): boolean {
  return raw[key] === "true";
}

/**
 * 读取必填数字，缺失或非数字立即抛错
 * @param key 环境变量名
 * @returns 转换后的数字
 */
export function num(key: string): number {
  const value = Number(str(key));
  if (!Number.isFinite(value)) throw new Error(`[env] ${key} 必须是数字`);
  return value;
}

/**
 * 读取可选数字
 * @param key 环境变量名
 * @returns 有效数字返回数字，缺失或非法返回 undefined
 */
export function optNum(key: string): number | undefined {
  const value = raw[key];
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
