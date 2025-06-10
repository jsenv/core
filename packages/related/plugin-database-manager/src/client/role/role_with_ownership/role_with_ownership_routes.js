import { registerRoute, valueInLocalStorage } from "@jsenv/router";
import { errorFromResponse } from "../../error_from_response.js";
import { setRoleTables } from "../role_signals.js";

// Cache avec WeakRef pour les routes
const roleRouteWeakRefs = new Map();

export const createRoleTableListDetailsRoute = ({ rolname }) => {
  // Vérifier si une route existe déjà
  const existingWeakRef = roleRouteWeakRefs.get(rolname);
  if (existingWeakRef) {
    const existingRoute = existingWeakRef.deref();
    if (existingRoute) {
      return existingRoute;
    }
    // La route a été garbage collectée, supprimer la WeakRef
    roleRouteWeakRefs.delete(rolname);
  }

  const [
    readRoleTableListDetailsOpened,
    storeRoleTableListDetailsOpened,
    eraseRoleTableListDetailsOpened,
  ] = valueInLocalStorage(`role_${rolname}_table_list_details_opened`, {
    type: "boolean",
  });

  // Créer une nouvelle route
  const route = registerRoute({
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

  // Stocker une WeakRef vers la route
  roleRouteWeakRefs.set(rolname, new WeakRef(route));

  return route;
};
