import { defineRoutes, setBaseUrl } from "@jsenv/navi";
import { DATABASE } from "./database/database_store.js";
import { ROLE } from "./role/role_store.js";
import { TABLE } from "./table/table_store.js";

setBaseUrl(window.DB_MANAGER_CONFIG.pathname);

let [ROLE_ROUTE, DATABASE_ROUTE, TABLE_ROUTE, TABLE_SETTINGS_ROUTE] =
  defineRoutes({
    "/roles/:rolname": ROLE.GET,
    "/databases/:datname": DATABASE.GET,
    "/tables/:tablename": TABLE.GET,
    "/tables/:tablename/settings": () => null,
  });

export { DATABASE_ROUTE, ROLE_ROUTE, TABLE_ROUTE, TABLE_SETTINGS_ROUTE };
