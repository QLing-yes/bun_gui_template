import { post, user } from "@/runtime/generated/model/mysql";

/** MySQL 表与关系测试 */
export default $g.ctrl((app) =>
  app
    .post(
      "user",
      {
        title: "创建用户（MySQL）",
        body: "schema_mysql_user",
      },
      async ({ body }) => {
        await $g.mysql.insert(user).values(body);
        return $g.success(body);
      },
    )
    .post(
      "post",
      {
        title: "创建文章（MySQL）",
        body: "schema_mysql_post",
      },
      async ({ body }) => {
        await $g.mysql.insert(post).values(body);
        return $g.success(body);
      },
    )
    .get("user", { title: "用户及文章列表（MySQL）" }, async () => {
      const rows = await $g.mysql.query.user.findMany({
        with: { posts: true },
      });
      return $g.success(rows);
    }),
);
