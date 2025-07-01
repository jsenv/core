import { resource, useActionData } from "@jsenv/navi";
import { signal } from "@preact/signals";
import { setRoleCounts } from "../database_signals.js";
import { errorFromResponse } from "../error_from_response.js";

export const ROLE = resource("role", {
  idKey: "oid",
  mutableIdKeys: ["rolname"],
  GET_MANY: async ({ canlogin }, { signal }) => {
    const getManyRoleUrl = new URL(`${window.DB_MANAGER_CONFIG.apiUrl}/roles`);
    if (canlogin) {
      getManyRoleUrl.searchParams.set("can_login", "");
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
    const {
      data,
      // { databases, columns, members }
      meta,
    } = await response.json();
    return {
      ...data,
      ...meta,
    };
  },
  POST: async ({ rolcanlogin, rolname }, { signal }) => {
    const response = await fetch(`${window.DB_MANAGER_CONFIG.apiUrl}/roles`, {
      signal,
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({ rolname, rolcanlogin }),
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
    if (columnName === "rolconnlimit") {
      columnValue = parseInt(columnValue, 10);
    }
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
    return {
      rolname,
      [columnName]: columnValue,
    };
  },
});

export const useRoleArray = ROLE.useArray;

ROLE.GET_MANY_CAN_LOGIN = ROLE.GET_MANY.bindParams({ canlogin: true });
export const useRoleCanLoginArray = () => {
  const roleCanLoginArray = useActionData(ROLE.GET_MANY_CAN_LOGIN);
  return roleCanLoginArray;
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

export const ROLE_MEMBERS = ROLE.many("members", ROLE, {
  POST: async ({ rolname, memberRolname }, { signal }) => {
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/roles/${rolname}/members/${memberRolname}`,
      {
        signal,
        method: "PUT",
      },
    );
    if (!response.ok) {
      throw await errorFromResponse(
        response,
        `Failed to add ${memberRolname} to ${rolname}`,
      );
    }
    const { data } = await response.json();
    const member = data;
    return [{ rolname }, member];
  },
  DELETE: async ({ rolname, memberRolname }, { signal }) => {
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/roles/${rolname}/members/${memberRolname}`,
      {
        signal,
        method: "DELETE",
      },
    );
    if (!response.ok) {
      throw await errorFromResponse(
        response,
        `Failed to remove ${memberRolname} from ${rolname}`,
      );
    }
    return [{ rolname }, { rolname: memberRolname }];
  },
});

ROLE.store.upsert(window.DB_MANAGER_CONFIG.currentRole);
