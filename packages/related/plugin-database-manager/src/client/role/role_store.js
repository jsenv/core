import { resource, useActionData } from "@jsenv/navi";
import { signal } from "@preact/signals";
import { setRoleCounts } from "../database_signals.js";
import { errorFromResponse } from "../error_from_response.js";

export const ROLE = resource("role", {
  idKey: "oid",
  mutableIdKeys: ["rolname"],
  GET_MANY: async ({ canlogin, owners }, { signal }) => {
    const getManyRoleUrl = new URL(`${window.DB_MANAGER_CONFIG.apiUrl}/roles`);
    if (canlogin !== undefined) {
      getManyRoleUrl.searchParams.set("can_login", canlogin);
    }
    if (owners) {
      getManyRoleUrl.searchParams.set("owners", owners);
    }
    const response = await fetch(getManyRoleUrl, { signal });
    if (!response.ok) {
      throw await errorFromResponse(response, "Failed to get roles");
    }
    const {
      data,
      // { currentRole }
      // meta,
    } = await response.json();
    return data;
  },
  GET: async ({ rolname }, { signal }) => {
    const getRoleUrl = new URL(
      `${window.DB_MANAGER_CONFIG.apiUrl}/roles/${rolname}`,
    );
    const response = await fetch(getRoleUrl, { signal });
    if (!response.ok) {
      throw await errorFromResponse(response, "Failed to get role");
    }
    const { data, meta } = await response.json();
    const { databases, members, columns } = meta;
    return {
      ...data,
      databases,
      members,
      meta: {
        columns,
      },
    };
  },
  POST: async ({ canlogin, rolname }, { signal }) => {
    const response = await fetch(`${window.DB_MANAGER_CONFIG.apiUrl}/roles`, {
      signal,
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({ rolname, rolcanlogin: canlogin }),
    });
    if (!response.ok) {
      throw await errorFromResponse(response, "Failed to create role");
    }
    const { data, meta } = await response.json();
    const { roleCounts } = meta;
    setRoleCounts(roleCounts);
    return data;
  },
  DELETE: async ({ rolname, signal }) => {
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/roles/${rolname}`,
      {
        signal,
        method: "DELETE",
        headers: {
          "accept": "application/json",
          "content-type": "application/json",
        },
      },
    );
    if (!response.ok) {
      throw await errorFromResponse(response, `Failed to delete role`);
    }
    const { meta } = await response.json();
    const { roleCounts } = meta;
    setRoleCounts(roleCounts);
    return { rolname };
  },
  PUT: async ({ rolname, columnName, columnValue }, { signal }) => {
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/roles/${rolname}/${columnName}`,
      {
        signal,
        method: "PUT",
        headers: {
          "accept": "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify(columnValue),
      },
    );
    if (!response.ok) {
      throw await errorFromResponse(response, "Failed to update role");
    }
    return ["rolname", rolname, { [columnName]: columnValue }];
  },
});

export const useRoleArrayInStore = ROLE.useArray;

export const ROLE_CAN_LOGIN = ROLE.withParams({ canlogin: true });
export const ROLE_CANNOT_LOGIN = ROLE.withParams({ canlogin: false });
export const useRoleCanLoginArray = () => {
  const roleCanLoginArray = useActionData(ROLE_CAN_LOGIN.GET_MANY);
  return roleCanLoginArray;
};
export const useRoleCannotLoginArray = () => {
  const roleCannotLoginArray = useActionData(ROLE_CANNOT_LOGIN.GET_MANY);
  return roleCannotLoginArray;
};

const currentRoleIdSignal = signal(window.DB_MANAGER_CONFIG.currentRole.oid);
export const setCurrentRoleId = (id) => {
  currentRoleIdSignal.value = id;
};
export const useCurrentRole = () => {
  const currentRoleId = currentRoleIdSignal.value;
  const currentRole = ROLE.store.select(currentRoleId);
  return currentRole;
};
