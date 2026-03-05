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
  ROLE_ROUTE: {
    pattern: `/roles/:rolname=${rolnameSignal}`,
    action: ROLE.GET,
  },
  DATABASE_ROUTE: {
    pattern: `/databases/:datname=${datnameSignal}`,
    action: DATABASE.GET,
  },
  TABLE_ROUTE: {
    pattern: `/tables/:tablename=${tablenameSignal}/`,
    action: TABLE.GET,
  },
  TABLE_DATA_ROUTE: {
    pattern: `/tables/:tablename=${tablenameSignal}`,
    action: TABLE_ROW.GET_MANY,
  },
  TABLE_SETTINGS_ROUTE: {
    pattern: `/tables/:tablename=${tablenameSignal}/settings`,
    action: createAction(() => {}, {
      name: "get table settings",
    }),
  },
});
