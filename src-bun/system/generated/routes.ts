// auto generated
import Elysia from "elysia";
import * as $g from "@/app/common";
import mod_0 from "app/controller/offline/test.ctrl.ts";
import mod_1 from "app/controller/api/chat.ctrl.ts";
import mod_2 from "app/controller/api/test.ctrl.ts";
import mod_3 from "app/controller/api/testsub/test.ctrl.ts";

const num = () => String($g.counter.n);

const plug_1 = () => new Elysia({ prefix: "testsub", detail: { tags:["/api/testsub"] }, name: num() })
	.use(mod_3)

const plug_0 = () => new Elysia({ prefix: "api", detail: { tags:["/api"] }, name: num() })
	.use(mod_1)
	.use(mod_2)
	.use(plug_1())

const plug_2 = () => new Elysia({ prefix: "offline", detail: { tags:["/offline"] }, name: num() })
	.use(mod_0)

export default new Elysia({ name: num() }).use(plug_0()).use(plug_2());
