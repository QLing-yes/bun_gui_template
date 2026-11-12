import { t } from "elysia";

export default $g.ctrl((app) =>
  app
    .post(
      "dynamic_response",
      {
        title: "动态响应类型测试",
        body: t.Object({ a: t.Number() }),

        // res: t.Number(),// Type validation has no effect, run-time normal validation
        // Equality ↑↓
        // response: $g.res(t.Number()),
      },
      ({ body }) => {
        if (body.a > 2) {
          return $g.error("no > 2");
        }
        return $g.success("1"); // Test type error
      },
    )
    .post(
      "success_response",
      { title: "成功响应测试", response: $g.res(t.String()) },
      () => {
        return $g.success("succData");
      },
    )
    .post(
      "error_response",
      { title: "错误响应测试", response: $g.res(t.String()) },
      () => {
        return $g.error("errData", 0);
      },
    )
    // .post(
    //   "response_type_error",
    //   {
    //     title: "响应类型错误测试",
    //     response: $g.res(t.Object({ a: t.Object({ b: t.String() }) })),
    //   },
    //   () => {
    //     return $g.success({ a: { b: 1 } });
    //   },
    // )
    .post("throw_error", { title: "抛出错误测试" }, () => {
      throw new Error("throwErr");
    })
    .post("throw_data", { title: "直接抛出数据测试" }, () => {
      throw "throwData";
    }),
);
