import { registerRoute, valueInLocalStorage } from "@jsenv/router";
import { roleStore } from "../role_store.js";

const [
  readRoleGroupsDetailsOpened,
  storeRoleGroupsDetailsOpened,
  eraseRoleGroupsDetailsOpened,
] = valueInLocalStorage("role_groups_details_opened", {
  type: "boolean",
});
export const ROLE_GROUPS_DETAILS_ROUTE = registerRoute({
  match: () => readRoleGroupsDetailsOpened(),
  enter: () => {
    storeRoleGroupsDetailsOpened(true);
  },
  leave: () => {
    eraseRoleGroupsDetailsOpened();
  },
  load: async () => {
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/roles?can_login=false`,
    );
    const { data } = await response.json();
    const roleGroups = data;
    roleStore.upsert(roleGroups);
  },
  name: "role_groups_details",
});
