import { stateSignal } from "@jsenv/navi";

export const tableListOpenSignal = stateSignal(false, {
  type: "boolean",
  id: "jsenv_db_table_list_open",
  persist: true,
});
export const tableListHeightSignal = stateSignal(undefined, {
  type: "float",
  id: "jsenv_db_table_list_height",
  persist: true,
});

// const [readTablesDetailsOpened, storeTablesDetailsOpened] = valueInLocalStorage(
//   "table_details_opened",
//   {
//     type: "boolean",
//     default: true,
//   },
// );
// export const TABLES_DETAILS_ROUTE = registerRoute({
//   match: () => readTablesDetailsOpened(),
//   enter: () => {
//     storeTablesDetailsOpened(true);
//   },
//   leave: () => {
//     storeTablesDetailsOpened(false);
//   },
//   load: async () => {
//     const response = await fetch(`${window.DB_MANAGER_CONFIG.apiUrl}/tables`);
//     const { data } = await response.json();
//     const tables = data;
//     tableStore.upsert(tables);
//   },
//   name: "tables_details",
// });
