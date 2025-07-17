import { defineRoutes } from "@jsenv/navi";
import { ROLE } from "./role/role_store.js";

const [ROLE_ROUTE] = defineRoutes({
  "/roles/:rolname": ROLE.GET,
});

export { ROLE_ROUTE };
