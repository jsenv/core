import { registerRoute, registerAction, goTo } from "@jsenv/router";
import {
  roleListSignal,
  setRoleColumns,
  upsertRole,
  removeRole,
} from "./role_signals.js";
import { effectWithPrevious } from "../effect_with_previous.js";

export const GET_ROLE_ROUTE = registerRoute(
  "/.internal/database/roles/:roleName",
  async ({ params, signal }) => {
    const roleName = params.roleName;
    const response = await fetch(`/.internal/database/api/roles/${roleName}`, {
      signal,
    });
    if (!response.ok) {
      const error = await response.json();
      const getRoleError = new Error(
        `Failed to get role: ${response.status} ${response.statusText}`,
      );
      getRoleError.stack = error.stack || error.message;
      throw getRoleError;
    }
    const { columns, role } = await response.json();
    setRoleColumns(columns);
    upsertRole(role.rolname, role);
  },
);
// cool mais marche pas lorsqu'on modifie l'id dans l'url, il faudrait modifier
// autre chose, ou alors que le front assigne un id en plus (oui c'est ca la soluce)
// donc soit on met un id dans le signal, soit on fait un truc encore different par dessus signal
// qui permet de detecter les changements de valeur sur un objet doné
// donc il faudrait bien un id par objet
effectWithPrevious([roleListSignal], ([roleListPrevious], [roleList]) => {
  const getRoleRouteIsMatching = GET_ROLE_ROUTE.isMatchingSignal.value;
  const getRoleRouteParams = GET_ROLE_ROUTE.paramsSignal.value;
  if (!getRoleRouteIsMatching) {
    return;
  }
  const getRouteRolename = getRoleRouteParams.roleName;
  const rolePreviousList = roleListPrevious.find(
    (role) => role.rolname === getRouteRolename,
  );
  if (!rolePreviousList) {
    return;
  }
  // find in the new list
  for (const role of roleList) {
    if (
      role.__id__ === rolePreviousList.__id__ &&
      role.rolname !== rolePreviousList.rolname
    ) {
      // rolname has changed
      const roleUrl = GET_ROLE_ROUTE.buildUrl(window.location.href, {
        roleName: role.rolname,
      });
      goTo(roleUrl, { replace: true });
    }
  }
});

export const PUT_ROLE_ACTION = registerAction(
  async ({ roleName, columnName, formData, signal }) => {
    let value = formData.get(columnName);
    if (columnName === "rolconnlimit") {
      value = parseInt(value, 10);
    }
    const response = await fetch(
      `/.internal/database/api/roles/${roleName}/${columnName}`,
      {
        signal,
        method: "PUT",
        headers: {
          "accept": "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify(value),
      },
    );
    if (!response.ok) {
      const error = await response.json();
      const updateRoleError = new Error(
        `Failed to update role: ${response.status} ${response.statusText}`,
      );
      updateRoleError.stack = error.stack || error.message;
      throw updateRoleError;
    }
    upsertRole(roleName, { [columnName]: value });
  },
);

export const POST_ROLE_ACTION = registerAction(async ({ signal, formData }) => {
  const roleName = formData.get("rolname");
  const response = await fetch(`/.internal/database/api/roles`, {
    signal,
    method: "POST",
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({ rolname: roleName }),
  });
  if (!response.ok) {
    const error = await response.json();
    const createRoleError = new Error(
      `Failed to create role: ${response.status} ${response.statusText}`,
    );
    createRoleError.stack = error.stack || error.message;
    throw createRoleError;
  }
  const role = await response.json();
  upsertRole(role.rolname, role);
});

export const DELETE_ROLE_ACTION = registerAction(
  async ({ roleName, signal }) => {
    const response = await fetch(`/.internal/database/api/roles/${roleName}`, {
      signal,
      method: "DELETE",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
      },
    });
    if (!response.ok) {
      const error = await response.json();
      const deleteRoleError = new Error(
        `Failed to delete role: ${response.status} ${response.statusText}`,
      );
      deleteRoleError.stack = error.stack || error.message;
      throw deleteRoleError;
    }
    removeRole(roleName);
  },
);
