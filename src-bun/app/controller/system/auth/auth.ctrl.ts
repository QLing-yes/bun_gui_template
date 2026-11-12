import { eq, or } from "drizzle-orm";
import { t } from "elysia";
import { collectPermRoutes } from "@/app/common/no_global";
import {
  AUTH,
  createSession,
  ensureDefaultRoles,
  getAccountInfo,
  hashPassword,
  revokeSession,
  roleIdByCode,
  rotateSession,
  verifyPassword,
  verifyPasswordDummy,
} from "@/app/lib/auth";
import { db } from "@/app/model/sqlite/db";
import {
  role_permission,
  user,
  user_role,
} from "@/runtime/generated/model/sqlite";

/** 登录名规则：字母或下划线开头，只含字母数字下划线 */
const USERNAME_PATTERN = "^[a-zA-Z_][a-zA-Z0-9_]*$";
/** 手机号规则：纯数字 6~20 位 */
const PHONE_PATTERN = "^\\d{6,20}$";

/** 请求体：注册 */
const registerBody = t.Object({
  username: t.String({
    minLength: 3,
    maxLength: 32,
    pattern: USERNAME_PATTERN,
    description: "登录名（字母或下划线开头，仅字母数字下划线）",
  }),
  password: t.String({ minLength: 8, maxLength: 128, description: "密码" }),
  email: t.Optional(
    t.String({ format: "email", maxLength: 255, description: "邮箱" }),
  ),
  phone: t.Optional(
    t.String({ pattern: PHONE_PATTERN, description: "手机号" }),
  ),
  nickname: t.Optional(t.String({ maxLength: 64, description: "显示名" })),
});

/** 请求体：登录 */
const loginBody = t.Object({
  identifier: t.String({
    minLength: 1,
    maxLength: 255,
    description: "用户名 / 邮箱 / 手机号",
  }),
  password: t.String({ minLength: 1, maxLength: 128, description: "密码" }),
});

/** 请求体：refresh token（刷新 / 登出共用） */
const tokenBody = t.Object({
  refreshToken: t.String({
    minLength: 20,
    maxLength: 256,
    description: "refresh token",
  }),
});

/** 会话元信息（设备 / IP） */
function sessionMeta(request: Request, ip?: string | null) {
  return {
    // 客户端可伪造超长 UA，截断避免脏数据膨胀
    userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
    ip: ip ?? null,
  };
}

/** 从请求中解析客户端 IP（优先取直连地址，代理头只取第一段） */
function clientIp(
  request: Request,
  server: { requestIP?: (req: Request) => { address?: string } | null } | null,
): string | null {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  return server?.requestIP?.(request)?.address ?? forwarded ?? null;
}

export default $g.ctrl((app) =>
  app
    /** 注册：创建账号并绑定默认角色（或引导超管），随后直接登录 */
    .post(
      "register",
      {
        title: "注册",
        desc: "用户名必填；邮箱、手机号可选但填写后需唯一",
        body: registerBody,
      },
      async ({ body, request, server, set }) => {
        const username = body.username.trim().toLowerCase();
        const email = body.email?.trim().toLowerCase() || null;
        const phone = body.phone?.trim() || null;

        /** 冲突条件：用户名 / 邮箱 / 手机号任一已存在 */
        const conditions = [eq(user.username, username)];
        if (email) conditions.push(eq(user.email, email));
        if (phone) conditions.push(eq(user.phone, phone));
        const exists = await db
          .select({ id: user.id })
          .from(user)
          .where(or(...conditions))
          .limit(1);
        if (exists.length > 0) {
          set.status = 409;
          return $g.error("用户名、邮箱或手机号已被占用");
        }

        await ensureDefaultRoles();
        const isBootstrapSuper =
          AUTH.bootstrapSuperAdmin !== "" &&
          username === AUTH.bootstrapSuperAdmin;
        const roleCode = isBootstrapSuper
          ? AUTH.superAdminCode
          : AUTH.defaultRoleCode;
        const roleId = await roleIdByCode(roleCode);
        if (roleId === undefined) {
          set.status = 500;
          return $g.error(`默认角色缺失：${roleCode}`);
        }

        const now = Date.now();
        const passwordHash = await hashPassword(body.password);
        const nickname = body.nickname?.trim() || null;
        let createdId: number;
        try {
          createdId = db.transaction((tx) => {
            const row = tx
              .insert(user)
              .values({
                username,
                email,
                phone,
                passwordHash,
                nickname,
                status: 1,
                lastLoginAt: now,
                passwordChangedAt: now,
                createdAt: now,
                updatedAt: now,
              })
              .returning({ id: user.id })
              .get();
            tx.insert(user_role)
              .values({ userId: row.id, roleId, createdAt: now })
              .run();
            return row.id;
          });
        } catch (error) {
          // 并发注册时预检查会失效，唯一索引冲突统一按占用处理
          const code = (error as { code?: string }).code;
          if (code?.startsWith("SQLITE_CONSTRAINT")) {
            set.status = 409;
            return $g.error("用户名、邮箱或手机号已被占用");
          }
          throw error;
        }

        const token = await createSession(
          { id: createdId, username },
          sessionMeta(request, clientIp(request, server)),
        );
        return $g.success(
          {
            user: {
              id: createdId,
              username,
              email,
              phone,
              nickname,
              roles: [roleCode],
            },
            token,
          },
          "注册成功",
        );
      },
    )

    /** 登录：用户名 / 邮箱 / 手机号 + 密码 */
    .post(
      "login",
      {
        title: "登录",
        desc: "支持用户名、邮箱或手机号登录",
        body: loginBody,
      },
      async ({ body, request, server, set }) => {
        const identifier = body.identifier.trim();
        const lower = identifier.toLowerCase();
        const digits = identifier.replace(/[\s-]/g, "");
        const rows = await db
          .select({
            id: user.id,
            username: user.username,
            passwordHash: user.passwordHash,
            status: user.status,
          })
          .from(user)
          .where(
            or(
              eq(user.username, lower),
              eq(user.email, lower),
              eq(user.phone, digits),
            ),
          )
          .limit(1);

        const row = rows[0];
        // 账号不存在也执行一次等时校验，避免通过耗时判断账号是否存在
        if (!row) {
          await verifyPasswordDummy(body.password);
          set.status = 401;
          return $g.error("用户名或密码错误");
        }
        if (!(await verifyPassword(body.password, row.passwordHash))) {
          set.status = 401;
          return $g.error("用户名或密码错误");
        }
        if (row.status !== 1) {
          set.status = 403;
          return $g.error("账号已被禁用");
        }

        const now = Date.now();
        await db
          .update(user)
          .set({ lastLoginAt: now, updatedAt: now })
          .where(eq(user.id, row.id));
        const token = await createSession(
          { id: row.id, username: row.username },
          sessionMeta(request, clientIp(request, server)),
        );
        return $g.success(
          { user: { id: row.id, username: row.username }, token },
          "登录成功",
        );
      },
    )

    /** 刷新：用 refresh token 换新凭据对（旧会话立即失效） */
    .post(
      "refresh",
      { title: "刷新令牌", body: tokenBody },
      async ({ body, request, server, set }) => {
        const result = await rotateSession(
          body.refreshToken,
          sessionMeta(request, clientIp(request, server)),
        );
        if (!result) {
          set.status = 401;
          return $g.error("refresh token 无效或已过期");
        }
        return $g.success({ user: result.user, token: result.tokens });
      },
    )

    /** 登出：撤销当前 refresh token 对应的会话 */
    .post("logout", { title: "登出", body: tokenBody }, ({ body }) => {
      revokeSession(body.refreshToken);
      return $g.success(null, "已登出");
    })

    /** 当前登录用户：资料 + 角色 + 权限编号（单次查询） */
    .get("me", { title: "当前登录用户" }, async ({ authUser, set }) => {
      if (!authUser) {
        set.status = 401;
        return $g.error("未登录");
      }
      const info = await getAccountInfo(authUser.userId);
      if (!info) {
        set.status = 404;
        return $g.error("用户不存在");
      }
      if (info.profile.status !== 1) {
        set.status = 403;
        return $g.error("账号已被禁用");
      }
      return $g.success({
        ...info.profile,
        isSuper: info.isSuper,
        perms: info.perms,
      });
    })

    /** 孤儿权限编号：数据库已绑定、但当前路由中不存在（用于清理历史绑定） */
    .post(
      "orphan_perm",
      {
        title: "获取孤儿权限编号",
        /** 孤儿权限编号列表（升序） */
        res: t.Array(t.Number()),
      },
      async () => {
        const { permRoutes } = await collectPermRoutes();
        const rows = await db
          .selectDistinct({ permCode: role_permission.permCode })
          .from(role_permission);
        const orphan = rows
          .map((row) => row.permCode)
          .filter((code) => !permRoutes.has(code))
          .sort((a, b) => a - b);
        return $g.success(orphan);
      },
    ),
);
