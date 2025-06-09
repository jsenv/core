import { registerRoute, valueInLocalStorage } from "@jsenv/router";
import { tableStore } from "./table_store.js";

const [readTablesDetailsOpened, storeTablesDetailsOpened] = valueInLocalStorage(
  "table_details_opened",
  {
    type: "boolean",
    default: true,
  },
);
export const TABLES_DETAILS_ROUTE = registerRoute({
  match: () => readTablesDetailsOpened(),
  enter: () => {
    storeTablesDetailsOpened(true);
  },
  leave: () => {
    storeTablesDetailsOpened(false);
  },
  load: async () => {
    const response = await fetch(`${window.DB_MANAGER_CONFIG.apiUrl}/tables`);
    const { tables } = await response.json();
    tableStore.upsert(tables);
  },
  name: "tables_details",
});
