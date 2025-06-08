import { registerRoute, valueInLocalStorage } from "@jsenv/router";
import { tableStore } from "./table_store.js";

const [readTableDetailsOpened, storeTableDetailsOpened] = valueInLocalStorage(
  "table_details_opened",
  {
    type: "boolean",
    default: true,
  },
);
export const TABLE_DETAILS_ROUTE = registerRoute({
  match: () => readTableDetailsOpened(),
  enter: () => {
    storeTableDetailsOpened(true);
  },
  leave: () => {
    storeTableDetailsOpened(false);
  },
  load: async () => {
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/explorer/tables`,
    );
    const { tables } = await response.json();
    tableStore.upsert(tables);
  },
  name: "table_explorer_details",
});
