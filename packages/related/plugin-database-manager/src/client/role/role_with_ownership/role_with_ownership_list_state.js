import { stateSignal } from "@jsenv/navi";

export const roleOwnershipOpenSignal = stateSignal(false, {
  type: "boolean",
  id: "jsenv_db_role_ownership_open",
  persist: true,
});
export const roleOwnershipHeightSignal = stateSignal(undefined, {
  type: "float",
  id: "jsenv_db_role_ownership_height",
  persist: true,
});
