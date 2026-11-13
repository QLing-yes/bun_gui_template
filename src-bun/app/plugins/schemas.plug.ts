import { Elysia } from "elysia";
import * as Schema from "@/app/common/schemas";

export default new Elysia({ name: "app/plugins/schemas.plug" }).model(Schema);
