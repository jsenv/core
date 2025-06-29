import { resource } from "@jsenv/navi";
import { signal } from "@preact/signals";
import { errorFromResponse } from "../error_from_response.js";

const canLoginCountSignal = signal(0);
const groupCountSignal = signal(0);
const withOwnershipCountSignal = signal(0);

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
    const { canLoginCount, groupCount, withOwnershipCount } = meta;
    canLoginCountSignal.value = canLoginCount;
    groupCountSignal.value = groupCount;
    withOwnershipCountSignal.value = withOwnershipCount;
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
    const { canLoginCount, groupCount, withOwnershipCount } = meta;
    canLoginCountSignal.value = canLoginCount;
    groupCountSignal.value = groupCount;
    withOwnershipCountSignal.value = withOwnershipCount;
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
