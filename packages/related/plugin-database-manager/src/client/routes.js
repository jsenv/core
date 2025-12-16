import { createAction, setBaseUrl, setupRoutes } from "@jsenv/navi";
import { DATABASE } from "./database/database_store.js";
import { ROLE } from "./role/role_store.js";
import { TABLE, TABLE_ROW } from "./table/table_store.js";

setBaseUrl(window.DB_MANAGER_CONFIG.pathname);

let [
  ROLE_ROUTE,
  DATABASE_ROUTE,
  TABLE_ROUTE,
  TABLE_DATA_ROUTE,
  TABLE_SETTINGS_ROUTE,
] = setupRoutes({
  "/roles/:rolname": ROLE.GET,
  "/databases/:datname": DATABASE.GET,
  "/tables/:tablename/*?": TABLE.GET,
  "/tables/:tablename": TABLE_ROW.GET_MANY,
  "/tables/:tablename/settings": createAction(() => {}, {
    name: "get table settings",
  }),
});

export {
  DATABASE_ROUTE,
  ROLE_ROUTE,
  TABLE_DATA_ROUTE,
  TABLE_ROUTE,
  TABLE_SETTINGS_ROUTE,
};
