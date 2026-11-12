import { post, user } from "@/runtime/generated/model/postgresql";

/** PostgreSQL 表与关系测试 */
export default $g.ctrl((app) =>
  app
    .post(
      "user",
      {
        title: "创建用户（PostgreSQL）",
        body: "schema_postgresql_user",
      },
      async ({ body }) => {
        await $g.pg.insert(user).values(body);
        return $g.success(body);
      },
    )
    .post(
      "post",
      {
        title: "创建文章（PostgreSQL）",
        body: "schema_postgresql_post",
      },
      async ({ body }) => {
        await $g.pg.insert(post).values(body);
        return $g.success(body);
      },
    )
    .get("user", { title: "用户及文章列表（PostgreSQL）" }, async () => {
      const rows = await $g.pg.query.user.findMany({
        with: { posts: true },
      });
      return $g.success(rows);
    }),
);
