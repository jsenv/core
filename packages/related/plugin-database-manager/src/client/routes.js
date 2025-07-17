import { defineRoutes, setBaseUrl } from "@jsenv/navi";
import { DATABASE } from "./database/database_store.js";
import { ROLE } from "./role/role_store.js";

setBaseUrl(window.DB_MANAGER_CONFIG.pathname);

const [ROLE_ROUTE, DATABASE_ROUTE] = defineRoutes({
  "/roles/:rolname": ROLE.GET,
  "/databases/:datname": DATABASE.GET,
});

export { DATABASE_ROUTE, ROLE_ROUTE };
