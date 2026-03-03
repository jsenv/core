import {
  createAction,
  setBaseUrl,
  setupRoutes,
  stateSignal,
} from "@jsenv/navi";

import { DATABASE } from "./database/database_store.js";
import { ROLE } from "./role/role_store.js";
import { TABLE, TABLE_ROW } from "./table/table_store.js";

setBaseUrl(window.DB_MANAGER_CONFIG.pathname);

export const rolnameSignal = stateSignal(null);
export const datnameSignal = stateSignal(null);
export const tablenameSignal = stateSignal(null);

export const {
  ROLE_ROUTE,
  DATABASE_ROUTE,
  TABLE_ROUTE,
  TABLE_DATA_ROUTE,
  TABLE_SETTINGS_ROUTE,
} = setupRoutes({
  ROLE_ROUTE: `/roles/:rolname=${rolnameSignal}`,
  DATABASE_ROUTE: `/databases/:datname=${datnameSignal}`,
  TABLE_ROUTE: `/tables/:tablename=${tablenameSignal}/`,
  TABLE_DATA_ROUTE: `/tables/:tablename=${tablenameSignal}`,
  TABLE_SETTINGS_ROUTE: `/tables/:tablename=${tablenameSignal}/settings`,
});

ROLE_ROUTE.bindAction(ROLE.GET);
DATABASE_ROUTE.bindAction(DATABASE.GET);
TABLE_ROUTE.bindAction(TABLE.GET);
TABLE_DATA_ROUTE.bindAction(TABLE_ROW.GET_MANY);
TABLE_SETTINGS_ROUTE.bindAction(
  createAction(() => {}, {
    name: "get table settings",
  }),
);
