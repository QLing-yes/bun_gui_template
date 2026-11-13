// auto generated
import Elysia from "elysia";
import mod_0 from "app/controller/test/test.ctrl.ts";
import mod_1 from "app/controller/test/sqlite/test.ctrl.ts";
import mod_2 from "app/controller/test/postgresql/test.ctrl.ts";
import mod_3 from "app/controller/test/mysql/test.ctrl.ts";
import mod_4 from "app/controller/system/system.ctrl.ts";
import mod_5 from "app/controller/system/auth/auth.ctrl.ts";
import mod_6 from "app/controller/offline/exit.ctrl.ts";
import mod_7 from "app/controller/api/chat.ctrl.ts";
import mod_8 from "app/controller/api/title.ctrl.ts";

const plug_3 = () => new Elysia({ prefix: "auth", detail: { tags:["/system/auth"] }, name: "generated:plug_3" })
	.use(mod_5)

const plug_5 = () => new Elysia({ prefix: "mysql", detail: { tags:["/test/mysql"] }, name: "generated:plug_5" })
	.use(mod_3)

const plug_6 = () => new Elysia({ prefix: "postgresql", detail: { tags:["/test/postgresql"] }, name: "generated:plug_6" })
	.use(mod_2)

const plug_7 = () => new Elysia({ prefix: "sqlite", detail: { tags:["/test/sqlite"] }, name: "generated:plug_7" })
	.use(mod_1)

const plug_0 = () => new Elysia({ prefix: "api", detail: { tags:["/api"] }, name: "generated:plug_0" })
	.use(mod_7)
	.use(mod_8)

const plug_1 = () => new Elysia({ prefix: "offline", detail: { tags:["/offline"] }, name: "generated:plug_1" })
	.use(mod_6)

const plug_2 = () => new Elysia({ prefix: "system", detail: { tags:["/system"] }, name: "generated:plug_2" })
	.use(mod_4)
	.use(plug_3())

const plug_4 = () => new Elysia({ prefix: "test", detail: { tags:["/test"] }, name: "generated:plug_4" })
	.use(mod_0)
	.use(plug_5())
	.use(plug_6())
	.use(plug_7())

export default new Elysia({ name: "generated:default" })
.use(plug_0())
.use(plug_1())
.use(plug_2())
.use(plug_4());
