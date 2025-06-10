import { registerRoute, valueInLocalStorage } from "@jsenv/router";
import { roleStore } from "../role_store.js";

const [
  readRoleWithOwnershipDetailsOpened,
  storeRoleWithOwnershipDetailsOpened,
  eraseRoleWithOwnsershipDetailsOpened,
] = valueInLocalStorage("role_with_ownership_details_opened", {
  type: "boolean",
});
export const ROLE_WITH_OWNERSHIP_DETAILS_ROUTE = registerRoute({
  match: () => readRoleWithOwnershipDetailsOpened(),
  enter: () => {
    storeRoleWithOwnershipDetailsOpened(true);
  },
  leave: () => {
    eraseRoleWithOwnsershipDetailsOpened();
  },
  load: async () => {
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/roles?owners`,
    );
    const { data } = await response.json();
    const rolesWithOwnership = data;
    roleStore.upsert(rolesWithOwnership);
  },
  name: "role_with_ownership_details",
});
