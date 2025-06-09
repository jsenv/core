import { registerRoute, valueInLocalStorage } from "@jsenv/router";
import { setCurrentDatabase } from "./database_signals.js";
import { databaseStore } from "./database_store.js";

const [readDatabasesDetailsOpened, storeDatabasesDetailsOpened] =
  valueInLocalStorage("databases_details_opened", {
    type: "boolean",
  });
export const DATABASES_DETAILS_ROUTE = registerRoute({
  match: () => readDatabasesDetailsOpened(),
  enter: () => {
    storeDatabasesDetailsOpened(true);
  },
  leave: () => {
    storeDatabasesDetailsOpened(false);
  },
  load: async () => {
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/databases`,
    );
    const { data, meta } = await response.json();
    const databases = data;
    const { currentDatabase } = meta;
    databaseStore.upsert(databases);
    setCurrentDatabase(currentDatabase);
  },
  name: "databases_details",
});
