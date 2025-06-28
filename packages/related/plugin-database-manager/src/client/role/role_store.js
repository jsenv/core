import { resource } from "@jsenv/navi";
import { errorFromResponse } from "../error_from_response.js";

export const ROLE = resource("role", {
  idKey: "oid",
  mutableIdKeys: ["rolname"],
  GET: async ({ rolname }, { signal }) => {
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/roles/${rolname}`,
      {
        signal,
      },
    );
    if (!response.ok) {
      throw await errorFromResponse(response, "Failed to get role");
    }
    const { data, meta } = await response.json();
    const role = data;
    const { databases, columns, members } = meta;
    setActiveRole(role);
    setActiveRoleDatabases(databases);
    setActiveRoleColumns(columns);
    setRoleMembers(role, members);
    return role;
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
    const role = data;
    const { canLoginCount, groupCount, withOwnershipCount } = meta;
    setRoleCanLoginCount(canLoginCount);
    setRoleGroupCount(groupCount);
    setRoleWithOwnershipCount(withOwnershipCount);
    return role;
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
    const { canLoginCount, groupCount, withOwnershipCount } = meta;
    setRoleCanLoginCount(canLoginCount);
    setRoleGroupCount(groupCount);
    setRoleWithOwnershipCount(withOwnershipCount);
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

export const ROLE_MEMBERS = ROLE.may("members", ROLE, {
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
