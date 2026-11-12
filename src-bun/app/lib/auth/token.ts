import { jwtVerify, SignJWT } from "jose";
import { AUTH } from "./config";

/** access token 载荷 */
export interface AccessPayload {
  /** 用户 ID */
  userId: number;
  /** 登录名 */
  username: string;
}

/** 签发 access token（HS256） */
export function signAccessToken(user: {
  id: number;
  username: string;
}): Promise<string> {
  return new SignJWT({ username: user.username })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuer(AUTH.issuer)
    .setAudience(AUTH.audience)
    .setIssuedAt()
    .setExpirationTime(`${AUTH.accessTtl}s`)
    .sign(AUTH.secret);
}

/** 校验 access token，失败返回 null */
export async function verifyAccessToken(
  token: string,
): Promise<AccessPayload | null> {
  try {
    const { payload } = await jwtVerify(token, AUTH.secret, {
      issuer: AUTH.issuer,
      audience: AUTH.audience,
      algorithms: ["HS256"],
    });
    const userId = Number(payload.sub);
    if (!Number.isInteger(userId) || userId <= 0) return null;
    return { userId, username: String(payload.username ?? "") };
  } catch {
    return null;
  }
}

/** 从请求头读取 Bearer token（容忍大小写与多余空白） */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  return /^Bearer\s+(.+)$/i.exec(header.trim())?.[1] ?? null;
}

/** 生成不透明 refresh token（32 字节随机，base64url） */
export function createRefreshToken(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString(
    "base64url",
  );
}

/** refresh token 的 SHA-256 摘要，数据库只存该值 */
export function hashRefreshToken(token: string): string {
  return new Bun.CryptoHasher("sha256").update(token).digest("hex");
}
