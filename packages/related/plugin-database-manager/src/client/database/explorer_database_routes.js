import { registerRoute, valueInLocalStorage } from "@jsenv/router";
import { setCurrentDatabase } from "./database_signals.js";
import { databaseStore } from "./database_store.js";

const [readDatabaseDetailsOpened, storeDatabaseDetailsOpened] =
  valueInLocalStorage("databases_details_opened", {
    type: "boolean",
  });
export const EXPLORER_DATABASES_ROUTE = registerRoute({
  match: () => readDatabaseDetailsOpened(),
  enter: () => {
    storeDatabaseDetailsOpened(true);
  },
  leave: () => {
    storeDatabaseDetailsOpened(false);
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
  name: "databases_explorer_details",
});
