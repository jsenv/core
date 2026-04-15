import {
  route,
  routeAction,
  setBaseUrl,
  setupRoutes,
  stateSignal,
} from "@jsenv/navi";

import {
  databaseHeightSignal,
  databaseOpenSignal,
} from "./database/database_state.js";
import { DATABASE } from "./database/database_store.js";
import { asideWidthSignal } from "./layout/aside.jsx";
import {
  roleCanLoginHeightSignal,
  roleCanLoginOpenSignal,
} from "./role/role_can_login/role_can_login_state.js";
import {
  roleGroupHeightSignal,
  roleGroupOpenSignal,
} from "./role/role_group/role_group_state.js";
import { ROLE, ROLE_CAN_LOGIN, ROLE_CANNOT_LOGIN } from "./role/role_store.js";
import {
  roleOwnershipHeightSignal,
  roleOwnershipOpenSignal,
} from "./role/role_with_ownership/role_with_ownership_list_state.js";
import { ROLE_WITH_OWNERSHIP } from "./store.js";
import {
  tableListHeightSignal,
  tableListOpenSignal,
} from "./table/table_list_state.js";
import {
  TABLE,
  TABLE_ROW,
  tableColumnNameSignal,
  tablenameSignal,
} from "./table/table_state.js";

setBaseUrl(`${window.DB_MANAGER_CONFIG.pathname}/`);

export const rolnameSignal = stateSignal(null);
export const datnameSignal = stateSignal(null);

export const INDEX_ROUTE = route("");
const ANY_ROUTE = route(`/`, {
  searchParams: {
    aside_width: asideWidthSignal,
    role_login_open: roleCanLoginOpenSignal,
    role_login_height: roleCanLoginHeightSignal,
    role_group_open: roleGroupOpenSignal,
    role_group_height: roleGroupHeightSignal,
    database_open: databaseOpenSignal,
    database_height: databaseHeightSignal,
    table_list_open: tableListOpenSignal,
    table_list_height: tableListHeightSignal,
    role_ownership_open: roleOwnershipOpenSignal,
    role_ownership_height: roleOwnershipHeightSignal,
  },
});
export const ROLE_CAN_LOGIN_GET_MANY_ACTION = routeAction(
  ANY_ROUTE,
  ROLE_CAN_LOGIN.GET_MANY,
  () => {
    const open = roleCanLoginOpenSignal.value;
    if (!open) {
      return null;
    }
    return {};
  },
);
export const ROLE_GROUP_GET_MANY_ACTION = routeAction(
  ANY_ROUTE,
  ROLE_CANNOT_LOGIN.GET_MANY,
  () => {
    const open = roleGroupOpenSignal.value;
    if (!open) {
      return null;
    }
    return {};
  },
);
export const DATABASE_GET_MANY_ACTION = routeAction(
  ANY_ROUTE,
  DATABASE.GET_MANY,
  () => {
    const open = databaseOpenSignal.value;
    if (!open) {
      return null;
    }
    return {};
  },
);
export const TABLE_GET_MANY_ACTION = routeAction(
  ANY_ROUTE,
  TABLE.GET_MANY,
  () => {
    const open = tableListOpenSignal.value;
    if (!open) {
      return null;
    }
    return {};
  },
);
export const ROLE_WITH_OWNERSHIP_GET_MANY_ACTION = routeAction(
  ANY_ROUTE,
  ROLE_WITH_OWNERSHIP.GET_MANY,
  () => {
    const open = roleOwnershipOpenSignal.value;
    if (!open) {
      return null;
    }
    return {};
  },
);

export const ROLE_ROUTE = route(`/roles/:rolname=${rolnameSignal}/`);
export const ROLE_GET_ACTION = routeAction(ROLE_ROUTE, ROLE.GET, () => {
  const rolname = rolnameSignal.value;
  return { rolname };
});

export const DATABASE_ROUTE = route(`/databases/:datname=${datnameSignal}/`);
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
export const TABLE_INDEX_ROUTE = route(
  `/tables/:tablename=${tablenameSignal}`,
  {
    searchParams: {
      column_name: tableColumnNameSignal,
    },
  },
);
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
  INDEX_ROUTE,
  ANY_ROUTE,
  ROLE_ROUTE,
  DATABASE_ROUTE,
  TABLE_ROUTE,
  TABLE_INDEX_ROUTE,
  TABLE_SETTINGS_ROUTE,
]);
