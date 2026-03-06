import { stateSignal } from "@jsenv/navi";

export const roleCanLoginOpenSignal = stateSignal(false, {
  type: "boolean",
  id: "jsenv_db_role_can_login_open",
  persist: true,
});
export const roleCanLoginHeightSignal = stateSignal(undefined, {
  type: "float",
  id: "jsenv_db_role_can_login_height",
  persist: true,
});
