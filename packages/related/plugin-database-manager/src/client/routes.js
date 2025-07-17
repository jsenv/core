import { defineRoutes, setBaseUrl } from "@jsenv/navi";
import { ROLE } from "./role/role_store.js";

setBaseUrl(window.DB_MANAGER_CONFIG.pathname);

const [ROLE_ROUTE] = defineRoutes({
  "/roles/:rolname": ROLE.GET,
});

export { ROLE_ROUTE };
