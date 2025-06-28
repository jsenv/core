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
