/** 密码哈希（Bun 原生 argon2id） */
export function hashPassword(plain: string): Promise<string> {
  return Bun.password.hash(plain, { algorithm: "argon2id" });
}

/** 校验密码 */
export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return Bun.password.verify(plain, hash);
}

let dummyHash: Promise<string> | undefined;

/** 用户不存在时的等时校验，避免通过响应时间判断账号是否存在 */
export async function verifyPasswordDummy(plain: string): Promise<void> {
  dummyHash ??= hashPassword("aigc-dummy-password");
  await Bun.password.verify(plain, await dummyHash);
}
