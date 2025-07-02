import { registerRoute, valueInLocalStorage } from "@jsenv/router";
import { roleStore } from "../role_store.js";

const [
  readRoleGroupListDetailsOpened,
  storeRoleGroupListDetailsOpened,
  eraseRoleGroupListDetailsOpened,
] = valueInLocalStorage("role_group_list_details_opened", {
  type: "boolean",
});
export const ROLE_GROUP_LIST_DETAILS_ROUTE = registerRoute({
  match: () => readRoleGroupListDetailsOpened(),
  enter: () => {
    storeRoleGroupListDetailsOpened(true);
  },
  leave: () => {
    eraseRoleGroupListDetailsOpened();
  },
  load: async () => {
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/roles?can_login=false`,
    );
    const { data } = await response.json();
    const roleGroups = data;
    roleStore.upsert(roleGroups);
  },
  name: "role_group_list_details",
});
