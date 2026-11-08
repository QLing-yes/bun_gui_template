import { cors } from "@elysia/cors";
import { openapi } from "@elysia/openapi";
import { staticPlugin } from "@elysia/static";
import { Elysia } from "elysia";
import routes from "@/system/generated/routes";
import plug_controller from "@/app/plugins/controller.plug";
import { createDir } from "@/app/utils/file";
// import { inAotBuild } from "elysia";

const env = process.env;

export const controller = plug_controller.use(routes);

const app = new Elysia({ name: String($g.counter.n) })
  .derive(() => {
    return { rid: crypto.randomUUID() };
  });

// if (!inAotBuild()) {
  // 按 .env 开关注册可选插件，默认开启
  if (env.CORS_ENABLED === "true") app.use(cors());
  if (env.OPENAPI_ENABLED === "true") app.use(openapi());
  if (env.STATIC_ENABLED === "true") {
    const op = {
      assets: "public",
      alwaysStatic: false
    };
    createDir(op.assets);
    app.use(staticPlugin(op));
  }
// }

export default app.use(controller);
