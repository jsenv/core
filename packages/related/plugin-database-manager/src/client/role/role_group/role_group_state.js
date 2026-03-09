import { stateSignal } from "@jsenv/navi";

export const roleGroupOpenSignal = stateSignal(false, {
  type: "boolean",
  id: "jsenv_db_role_group_open",
  persist: true,
});
export const roleGroupHeightSignal = stateSignal(undefined, {
  type: "float",
  id: "jsenv_db_role_group_height",
  persist: true,
});
