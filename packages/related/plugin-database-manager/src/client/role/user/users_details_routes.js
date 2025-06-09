import { registerRoute, valueInLocalStorage } from "@jsenv/router";
import { setCurrentRole } from "../role_signals.js";
import { roleStore } from "../role_store.js";

const [
  readRolesDetailsOpened,
  storeRolesDetailsOpened,
  eraseRolesDetailsOpened,
] = valueInLocalStorage("users_details_opened", {
  type: "boolean",
});
export const USERS_DETAILS_ROUTE = registerRoute({
  match: () => readRolesDetailsOpened(),
  enter: () => {
    storeRolesDetailsOpened(true);
  },
  leave: () => {
    eraseRolesDetailsOpened();
  },
  load: async () => {
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/roles?can_login`,
    );
    const { data, meta } = await response.json();
    const roles = data;
    setCurrentRole(meta.currentRole);
    roleStore.upsert(roles);
  },
  name: "users_details",
});
