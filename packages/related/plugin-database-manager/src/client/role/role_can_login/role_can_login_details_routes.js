import { registerRoute, valueInLocalStorage } from "@jsenv/router";
import { setCurrentRole } from "../role_signals.js";
import { roleStore } from "../role_store.js";

const [
  readRoleCanLoginDetailsOpened,
  storeRoleCanLoginDetailsOpened,
  eraseRoleCanLoginDetailsOpened,
] = valueInLocalStorage("role_can_login_details_opened", {
  type: "boolean",
});
export const ROLE_CAN_LOGIN_DETAILS_ROUTE = registerRoute({
  match: () => readRoleCanLoginDetailsOpened(),
  enter: () => {
    storeRoleCanLoginDetailsOpened(true);
  },
  leave: () => {
    eraseRoleCanLoginDetailsOpened();
  },
  load: async () => {
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/roles?can_login`,
    );
    const { data, meta } = await response.json();
    const rolesCanLogin = data;
    setCurrentRole(meta.currentRole);
    roleStore.upsert(rolesCanLogin);
  },
  name: "role_can_login_details",
});
