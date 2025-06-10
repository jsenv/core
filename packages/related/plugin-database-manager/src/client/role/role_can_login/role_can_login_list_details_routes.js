import { registerRoute, valueInLocalStorage } from "@jsenv/router";
import { setCurrentRole } from "../role_signals.js";
import { roleStore } from "../role_store.js";

const [
  readRoleCanLoginListDetailsOpened,
  storeRoleCanLoginListDetailsOpened,
  eraseRoleCanLoginListDetailsOpened,
] = valueInLocalStorage("role_can_login_list_details_opened", {
  type: "boolean",
});
export const ROLE_CAN_LOGIN_LIST_DETAILS_ROUTE = registerRoute({
  match: () => readRoleCanLoginListDetailsOpened(),
  enter: () => {
    storeRoleCanLoginListDetailsOpened(true);
  },
  leave: () => {
    eraseRoleCanLoginListDetailsOpened();
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
  name: "role_can_login_list_details",
});
