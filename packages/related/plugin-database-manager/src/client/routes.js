import {
  createAction,
  setBaseUrl,
  setupRoutes,
  stateSignal,
} from "@jsenv/navi";

import { DATABASE } from "./database/database_store.js";
import {
  roleCanLoginHeightSignal,
  roleCanLoginOpenSignal,
} from "./role/role_can_login/role_can_login_state.js";
import { ROLE } from "./role/role_store.js";
import { TABLE, TABLE_ROW } from "./table/table_store.js";

setBaseUrl(window.DB_MANAGER_CONFIG.pathname);

export const rolnameSignal = stateSignal(null);
export const datnameSignal = stateSignal(null);
export const tablenameSignal = stateSignal(null);

// TODO: roleCanLoginOpenSignal controls ROLE_CAN_LOGIN.GET_MANY
// so we need this logic somehow
// we likely can groupe that with the search param debounce concept where a search param
// controls an action but with a debouncing logic
// as a result it means the details element should actually only controls the roleCanLoginOpenSignal
// and not run the action itself
// however we still want to connect the details with the state of the action
// so we likely have a missing concept here
// where a UI element can be bound to an action but would actuall not trigger the action per se
// because in the end actions are core things that can often/always be triggered outside UI
// so UI is just an other way of triggering an action but should be able to catch if anything else does

export const {
  ROLE_ROUTE,
  DATABASE_ROUTE,
  TABLE_ROUTE,
  TABLE_DATA_ROUTE,
  TABLE_SETTINGS_ROUTE,
} = setupRoutes({
  HOME_ROUTE: `/?role_login_opened=${roleCanLoginOpenSignal}&role_login_height=${roleCanLoginHeightSignal}`,
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
