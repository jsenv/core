import { stateSignal } from "@jsenv/navi";

export const databaseOpenSignal = stateSignal(false, {
  type: "boolean",
  id: "jsenv_db_database_open",
  persist: true,
});
export const databaseHeightSignal = stateSignal(undefined, {
  type: "float",
  id: "jsenv_db_database_height",
  persist: true,
});
