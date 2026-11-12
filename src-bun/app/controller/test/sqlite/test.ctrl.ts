import { post, user } from "@/system/generated/model/sqlite";

/** SQLite 表与关系测试 */
export default $g.ctrl((app) =>
  app
    .post(
      "user",
      {
        title: "创建用户（SQLite）",
        body: "schema_sqlite_user",
      },
      async ({ body }) => {
        await $g.sqlite.insert(user).values(body);
        return $g.success(body);
      },
    )
    .post(
      "post",
      {
        title: "创建文章（SQLite）",
        body: "schema_sqlite_post",
      },
      async ({ body }) => {
        await $g.sqlite.insert(post).values(body);
        return $g.success(body);
      },
    )
    .get("user", { title: "用户及文章列表（SQLite）" }, async () => {
      const rows = await $g.sqlite.query.user.findMany({
        with: { posts: true },
      });
      return $g.success(rows);
    }),
);
