import { registerRoute, valueInLocalStorage } from "@jsenv/router";
import { roleStore } from "../role_store.js";

const [
  readGroupsDetailsOpened,
  storeGroupsDetailsOpened,
  eraseGroupsDetailsOpened,
] = valueInLocalStorage("groups_details_opened", {
  type: "boolean",
});
export const GROUPS_DETAILS_ROUTE = registerRoute({
  match: () => readGroupsDetailsOpened(),
  enter: () => {
    storeGroupsDetailsOpened(true);
  },
  leave: () => {
    eraseGroupsDetailsOpened();
  },
  load: async () => {
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/roles?can_login=false`,
    );
    const { data } = await response.json();
    const groupRoles = data;
    roleStore.upsert(groupRoles);
  },
  name: "groups_details",
});
