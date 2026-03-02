import { createAction, setBaseUrl, setupRoutes } from "@jsenv/navi";
import { DATABASE } from "./database/database_store.js";
import { ROLE } from "./role/role_store.js";
import { TABLE, TABLE_ROW } from "./table/table_store.js";

setBaseUrl(window.DB_MANAGER_CONFIG.pathname);

export const [
  ROLE_ROUTE,
  DATABASE_ROUTE,
  TABLE_ROUTE,
  TABLE_ROW_ROUTE,
  TABLE_SETTINGS_ROUTE,
] = setupRoutes({
  ROLE_ROUTE: "/roles/:rolname",
  DATABASE_ROUTE: "/databases/:datname",
  TABLE_ROUTE: "/tables/:tablename/",
  TABLE_ROW_ROUTE: "/tables/:tablename",
  TABLE_SETTINGS_ROUTE: "/tables/:tablename/settings",
});

ROLE_ROUTE.bindAction(ROLE.GET);
DATABASE_ROUTE.bindAction(DATABASE.GET);
TABLE_ROUTE.bindAction(TABLE.GET);
TABLE_ROW_ROUTE.bindAction(TABLE_ROW.GET_MANY);
TABLE_SETTINGS_ROUTE.bindAction(
  createAction(() => {}, {
    name: "get table settings",
  }),
);
