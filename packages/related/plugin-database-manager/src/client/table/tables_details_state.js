import { valueInLocalStorage } from "@jsenv/navi";

const [
  readTableListDetailsOpened,
  storeTableListDetailsOpened,
  eraseTableListDetailsOpened,
] = valueInLocalStorage("table_list_details_opened", {
  type: "boolean",
  default: true,
});

export const tableListDetailsOpenAtStart = readTableListDetailsOpened();

export const tableListDetailsOnToggle = (detailsOpen) => {
  if (detailsOpen) {
    eraseTableListDetailsOpened();
  } else {
    storeTableListDetailsOpened(false);
  }
};

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
