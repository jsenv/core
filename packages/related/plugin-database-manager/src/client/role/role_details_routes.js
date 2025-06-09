import { registerRoute, valueInLocalStorage } from "@jsenv/router";
import { setCurrentRole } from "./role_signals.js";
import { roleStore } from "./role_store.js";

const [
  readRolesDetailsOpened,
  storeRolesDetailsOpened,
  eraseRolesDetailsOpened,
] = valueInLocalStorage("role_details_opened", {
  type: "boolean",
});
export const ROLES_DETAILS_ROUTE = registerRoute({
  match: () => readRolesDetailsOpened(),
  enter: () => {
    storeRolesDetailsOpened(true);
  },
  leave: () => {
    eraseRolesDetailsOpened();
  },
  load: async () => {
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/roles?owners`,
    );
    const { data, meta } = await response.json();
    const roles = data;
    setCurrentRole(meta.currentRole);
    roleStore.upsert(roles);
  },
  name: "roles_details",
});

const [
  readOwnershipDetailsOpened,
  storeOwnershipDetailsOpened,
  eraseOwnsershipDetailsOpened,
] = valueInLocalStorage("ownership_details_opened", {
  type: "boolean",
});
export const OWNERSHIP_DETAILS_ROUTE = registerRoute({
  match: () => readOwnershipDetailsOpened(),
  enter: () => {
    storeOwnershipDetailsOpened(true);
  },
  leave: () => {
    eraseOwnsershipDetailsOpened();
  },
  load: async () => {
    const response = await fetch(`${window.DB_MANAGER_CONFIG.apiUrl}/roles`);
    const { data } = await response.json();
    const roles = data;
    roleStore.upsert(roles);
  },
  name: "ownership_details",
});
