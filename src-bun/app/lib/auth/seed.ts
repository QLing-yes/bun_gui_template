import { eq } from "drizzle-orm";
import { db } from "@/app/model/sqlite/db";
import { role } from "@/system/generated/model/sqlite";
import { AUTH } from "./config";

/** 内置角色定义（按 code 幂等写入） */
const DEFAULT_ROLES = [
  {
    code: AUTH.superAdminCode,
    name: "超级管理员",
    description: "内置角色，拥有全部接口权限，禁止删除",
    level: 100,
    sort: 1,
  },
  {
    code: "admin",
    name: "管理员",
    description: "内置角色，可按需绑定管理类接口权限",
    level: 50,
    sort: 2,
  },
  {
    code: AUTH.defaultRoleCode,
    name: "普通用户",
    description: "内置角色，注册时默认分配",
    level: 10,
    sort: 3,
  },
] as const;

let seeding: Promise<void> | undefined;

/** 确保内置角色存在（幂等，进程内只执行一次；失败后允许下次重试） */
export function ensureDefaultRoles(): Promise<void> {
  if (seeding) return seeding;
  seeding = (async () => {
    const now = Date.now();
    for (const item of DEFAULT_ROLES) {
      await db
        .insert(role)
        .values({
          ...item,
          isSystem: true,
          status: 1,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing({ target: role.code });
    }
  })().catch((error) => {
    seeding = undefined;
    throw error;
  });
  return seeding;
}

/** 按角色标识查主键 */
export async function roleIdByCode(code: string): Promise<number | undefined> {
  const rows = await db
    .select({ id: role.id })
    .from(role)
    .where(eq(role.code, code))
    .limit(1);
  return rows[0]?.id;
}
