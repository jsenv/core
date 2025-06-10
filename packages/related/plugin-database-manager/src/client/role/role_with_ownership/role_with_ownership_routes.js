import { registerRoute, valueInLocalStorage } from "@jsenv/router";
import { errorFromResponse } from "../../error_from_response.js";
import { setRoleTables } from "../role_signals.js";

export const createRoleTableListDetailsRoute = ({ rolname }) => {
  const [
    readRoleTableListDetailsOpened,
    storeRoleTableListDetailsOpened,
    eraseRoleTableListDetailsOpened,
  ] = valueInLocalStorage(`role_${rolname}_table_list_details_opened`, {
    type: "boolean",
  });

  const ROLE_TABLE_LIST_DETAILS_ROUTE = registerRoute({
    match: () => readRoleTableListDetailsOpened(),
    enter: () => {
      storeRoleTableListDetailsOpened(true);
    },
    leave: () => {
      eraseRoleTableListDetailsOpened();
    },
    load: async ({ signal }) => {
      const response = await fetch(
        `${window.DB_MANAGER_CONFIG.apiUrl}/roles/${rolname}/tables`,
        {
          signal,
        },
      );
      if (!response.ok) {
        throw await errorFromResponse(
          response,
          `Failed to get tables for role ${rolname}`,
        );
      }
      const { data } = await response.json();
      setRoleTables(rolname, data);
    },
    name: `role_${rolname}_table_list_details`,
  });

  return ROLE_TABLE_LIST_DETAILS_ROUTE;
};
