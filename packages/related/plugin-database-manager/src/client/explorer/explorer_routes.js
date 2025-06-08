import { registerRoute, valueInLocalStorage } from "@jsenv/router";
import { effect } from "@preact/signals";
import {
  setCurrentDatabase,
  setDatabaseCount,
} from "../database/database_signals.js";
import { databaseStore } from "../database/database_store.js";
import { setCurrentRole, setRoleCount } from "../role/role_signals.js";
import { roleStore } from "../role/role_store.js";
import { setTableCount } from "../table/table_signals.js";
import { tableStore } from "../table/table_store.js";

effect(async () => {
  const response = await fetch(`${window.DB_MANAGER_CONFIG.apiUrl}/explorer`);
  const { tableCount, databaseCount, roleCount } = await response.json();
  setTableCount(tableCount);
  setDatabaseCount(databaseCount);
  setRoleCount(roleCount);
});

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
    storeDatabaseDetailsOpened(true);
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
      `${window.DB_MANAGER_CONFIG.apiUrl}/explorer/databases`,
    );
    const { data, meta } = await response.json();
    const databases = data;
    const { currentDatabase } = meta;
    databaseStore.upsert(databases);
    setCurrentDatabase(currentDatabase);
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
  match: () => readRolesDetailsOpened(),
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
    const { data, meta } = await response.json();
    const roles = data;
    setCurrentRole(meta.currentRole);
    roleStore.upsert(roles);
  },
  name: "roles_explorer_details",
});

const [
  readOwnersDetailsOpened,
  storeOwnersDetailsOpened,
  eraseOwnsersDetailsOpened,
] = valueInLocalStorage("explorer_owners_opened", {
  type: "boolean",
});
export const EXPLORER_OWNERS_ROUTE = registerRoute({
  match: () => readOwnersDetailsOpened(),
  enter: () => {
    storeOwnersDetailsOpened(true);
  },
  leave: () => {
    eraseOwnsersDetailsOpened();
  },
  load: async () => {
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/explorer/owners`,
    );
    const { data } = await response.json();
    const owners = data;
    for (const role of owners) {
      roleStore.upsert(role);
    }
  },
  name: "owners_explorer_details",
});
