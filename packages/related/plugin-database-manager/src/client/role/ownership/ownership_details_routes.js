import { registerRoute, valueInLocalStorage } from "@jsenv/router";
import { roleStore } from "../role_store.js";

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
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/roles?owners`,
    );
    const { data } = await response.json();
    const roles = data;
    roleStore.upsert(roles);
  },
  name: "ownership_details",
});
