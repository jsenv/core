import {
  route,
  routeAction,
  setBaseUrl,
  setupRoutes,
  stateSignal,
} from "@jsenv/navi";

import { DATABASE } from "./database/database_store.js";
import {
  roleCanLoginHeightSignal,
  roleCanLoginOpenSignal,
} from "./role/role_can_login/role_can_login_state.js";
import { ROLE, ROLE_CAN_LOGIN } from "./role/role_store.js";
import { TABLE, TABLE_ROW } from "./table/table_store.js";

setBaseUrl(window.DB_MANAGER_CONFIG.pathname);

export const rolnameSignal = stateSignal(null);
export const datnameSignal = stateSignal(null);
export const tablenameSignal = stateSignal(null);

export const HOME_ROUTE = route(`/`, {
  searchParams: {
    role_login_open: roleCanLoginOpenSignal,
    role_login_height: roleCanLoginHeightSignal,
  },
});
ROLE_CAN_LOGIN.GET_MANY.meta.debug = true;
export const ROLE_CAN_LOGIN_GET_MANY_ACTION = routeAction(
  HOME_ROUTE,
  ROLE_CAN_LOGIN.GET_MANY,
  () => {
    const open = roleCanLoginOpenSignal.value;
    if (!open) {
      return null;
    }
    return true;
  },
);

export const ROLE_ROUTE = route(`/roles/:rolname=${rolnameSignal}`);
export const ROLE_GET_ACTION = routeAction(ROLE_ROUTE, ROLE.GET, () => {
  const rolname = rolnameSignal.value;
  return { rolname };
});

export const DATABASE_ROUTE = route(`/databases/:datname=${datnameSignal}`);
export const DATABASE_GET_ACTION = routeAction(
  DATABASE_ROUTE,
  DATABASE.GET,
  () => {
    const datname = datnameSignal.value;
    return { datname };
  },
);

export const TABLE_ROUTE = route(`/tables/:tablename=${tablenameSignal}/`);
export const TABLE_GET_ACTION = routeAction(TABLE_ROUTE, TABLE.GET, () => {
  const tablename = tablenameSignal.value;
  return { tablename };
});

export const TABLE_INDEX_ROUTE = route(`/tables/:tablename=${tablenameSignal}`);
export const TABLE_ROW_GET_MANY_ACTION = routeAction(
  TABLE_INDEX_ROUTE,
  TABLE_ROW.GET_MANY,
  () => {
    const tablename = tablenameSignal.value;
    return { tablename };
  },
);

export const TABLE_SETTINGS_ROUTE = route(
  `/tables/:tablename=${tablenameSignal}/settings`,
);

setupRoutes([
  HOME_ROUTE,
  ROLE_ROUTE,
  DATABASE_ROUTE,
  TABLE_ROUTE,
  TABLE_INDEX_ROUTE,
  TABLE_SETTINGS_ROUTE,
]);
