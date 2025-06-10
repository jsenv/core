import { registerAction, registerRoute } from "@jsenv/router";
import { connectStoreAndRoute } from "@jsenv/sigi";
import { errorFromResponse } from "../error_from_response.js";
import { setRoleCanLoginCount } from "./role_can_login/role_can_login_signals.js";
import { setRoleGroupCount } from "./role_group/role_group_signals.js";
import {
  setActiveRole,
  setActiveRoleColumns,
  setActiveRoleDatabases,
} from "./role_signals.js";
import { roleStore } from "./role_store.js";
import { setRoleWithOwnershipCount } from "./role_with_ownership/role_with_ownership_signals.js";

export const GET_ROLE_ROUTE = registerRoute(
  "/roles/:rolname",
  async ({ params, signal }) => {
    const rolname = params.rolname;
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
    const { databases, columns } = meta;
    setActiveRole(role);
    setActiveRoleDatabases(databases);
    setActiveRoleColumns(columns);
  },
);
connectStoreAndRoute(roleStore, GET_ROLE_ROUTE, "rolname");

export const PUT_ROLE_ACTION = registerAction(
  async ({ rolname, columnName, formData, signal }) => {
    let value = formData.get(columnName);
    if (columnName === "rolconnlimit") {
      value = parseInt(value, 10);
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
        body: JSON.stringify(value),
      },
    );
    if (!response.ok) {
      throw await errorFromResponse(response, "Failed to update role");
    }
    roleStore.upsert("rolname", rolname, { [columnName]: value });
  },
);

export const POST_ROLE_ACTION = registerAction(
  async ({ signal, rolcanlogin, formData }) => {
    const rolname = formData.get("rolname");
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
    roleStore.upsert(role);
    const { canLoginCount, groupCount, withOwnershipCount } = meta;
    setRoleCanLoginCount(canLoginCount);
    setRoleGroupCount(groupCount);
    setRoleWithOwnershipCount(withOwnershipCount);
  },
);

export const DELETE_ROLE_ACTION = registerAction(
  async ({ rolname, signal }) => {
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
    roleStore.drop("rolname", rolname);
    const { canLoginCount, groupCount, withOwnershipCount } = meta;
    setRoleCanLoginCount(canLoginCount);
    setRoleGroupCount(groupCount);
    setRoleWithOwnershipCount(withOwnershipCount);
  },
);

export const ADD_MEMBER_ACTION = registerAction(
  async ({ rolname, formData, signal }) => {
    const memberRolname = formData.get("membername");
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
    // TODO: insert the members in the role array
    // roleStore.upsert("rolname", rolname, { members: [...role.members] });
  },
);

export const REMOVE_MEMBER_ACTION = registerAction(
  async ({ rolname, memberRolname, signal }) => {
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
  },
);
