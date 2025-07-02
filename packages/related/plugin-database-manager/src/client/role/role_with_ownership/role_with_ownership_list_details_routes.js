import { registerRoute, valueInLocalStorage } from "@jsenv/router";
import { roleStore } from "../role_store.js";

const [
  readRoleWithOwnershipListDetailsOpened,
  storeRoleWithOwnershipListDetailsOpened,
  eraseRoleWithOwnsershipListDetailsOpened,
] = valueInLocalStorage("role_with_ownership_list_details_opened", {
  type: "boolean",
});
export const ROLE_WITH_OWNERSHIP_LIST_DETAILS_ROUTE = registerRoute({
  match: () => readRoleWithOwnershipListDetailsOpened(),
  enter: () => {
    storeRoleWithOwnershipListDetailsOpened(true);
  },
  leave: () => {
    eraseRoleWithOwnsershipListDetailsOpened();
  },
  load: async () => {
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/roles?owners`,
    );
    const { data } = await response.json();
    const roleWithOwnershipArray = data;
    roleStore.upsert(roleWithOwnershipArray);
  },
  name: "role_with_ownership_list_details",
});
