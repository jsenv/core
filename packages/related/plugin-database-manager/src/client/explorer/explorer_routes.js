import { registerRoute, valueInLocalStorage } from "@jsenv/router";
import { effect } from "@preact/signals";
import { setDatabaseCount } from "../database/database_signals.js";
import { setCurrentRole, setRoleCount } from "../role/role_signals.js";
import { roleStore } from "../role/role_store.js";
import { setTableCount } from "../table/table_signals.js";

effect(async () => {
  const response = await fetch(`${window.DB_MANAGER_CONFIG.apiUrl}/explorer`);
  const { tableCount, databaseCount, roleCount } = await response.json();
  setTableCount(tableCount);
  setDatabaseCount(databaseCount);
  setRoleCount(roleCount);
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
    const response = await fetch(`${window.DB_MANAGER_CONFIG.apiUrl}/roles`);
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
    const response = await fetch(`${window.DB_MANAGER_CONFIG.apiUrl}/roles`);
    const { data } = await response.json();
    const roles = data;
    roleStore.upsert(roles);
  },
  name: "owners_explorer_details",
});
