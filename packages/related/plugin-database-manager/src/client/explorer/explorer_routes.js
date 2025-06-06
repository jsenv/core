import { registerRoute, valueInLocalStorage } from "@jsenv/router";
import { effect } from "@preact/signals";
import {
  setCurrentDatabase,
  setDatabaseCount,
} from "../database/database_signals.js";
import { databaseStore } from "../database/database_store.js";
import { setCurrentRole, setRoleCount } from "../role/role_signals.js";
import { roleStore } from "../role/role_store.js";

effect(async () => {
  const response = await fetch(`${window.DB_MANAGER_CONFIG.apiUrl}/explorer`);
  const { databaseCount, roleCount } = await response.json();
  setDatabaseCount(databaseCount);
  setRoleCount(roleCount);
});

const [readDatabaseDetailsOpened, storeDatabaseDetailsOpened] =
  valueInLocalStorage("databases_details_opened", {
    type: "boolean",
    default: true,
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
      `${window.DB_MANAGER_CONFIG.apiUrl}/explorer/databases`,
    );
    const { currentDatabase, databases } = await response.json();
    setCurrentDatabase(currentDatabase);
    databaseStore.upsert(databases);
  },
  name: "databases_explorer_details",
});

const [
  readRolesDetailsOpened,
  storeRolesDetailsOpened,
  eraseRolesDetailsOpened,
] = valueInLocalStorage("explorer_roles_opened", {
  type: "boolean",
});
export const EXPLORER_ROLES_ROUTE = registerRoute({
  match: () => readRolesDetailsOpened,
  enter: () => {
    storeRolesDetailsOpened(true);
  },
  leave: () => {
    eraseRolesDetailsOpened();
  },
  load: async () => {
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/explorer/roles`,
    );
    const { currentRole, roles } = await response.json();
    setCurrentRole(currentRole);
    roleStore.upsert(roles);
  },
  name: "roles_explorer_details",
});
