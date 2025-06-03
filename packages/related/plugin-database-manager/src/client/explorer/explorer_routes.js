import { registerRoute } from "@jsenv/router";
import { setCurrentDatabase } from "../database/database_signals.js";
import { databaseStore } from "../database/database_store.js";
import { setCurrentRole } from "../role/role_signals.js";
import { roleStore } from "../role/role_store.js";

export const EXPLORER_DATABASES_ROUTE = registerRoute({
  match: (state) => state.explorer_databases_opened === true,
  enter: (state) => {
    state.explorer_databases_opened = true;
  },
  leave: (state) => {
    state.explorer_databases_opened = false;
  },
  load: async () => {
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/explorer/databases`,
    );
    const { currentDatabase, databases } = await response.json();
    setCurrentDatabase(currentDatabase);
    databaseStore.upsert(databases);
  },
});

export const EXPLORER_ROLES_ROUTE = registerRoute({
  match: (state) => state.explorer_roles_opened === true,
  enter: (state) => {
    state.explorer_roles_opened = true;
  },
  leave: (state) => {
    state.explorer_roles_opened = false;
  },
  load: async () => {
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/explorer/roles`,
    );
    const { currentRole, roles } = await response.json();
    setCurrentRole(currentRole);
    roleStore.upsert(roles);
  },
});
