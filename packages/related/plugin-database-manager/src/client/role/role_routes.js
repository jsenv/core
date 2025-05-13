import { registerAction, registerRoute } from "@jsenv/router";
import { connectStoreAndRoute } from "@jsenv/sigi";
import {
  setActiveRole,
  setActiveRoleColumns,
  setActiveRoleDatabases,
} from "./role_signals.js";
import { roleStore } from "./role_store.js";

export const GET_ROLE_ROUTE = registerRoute(
  "/roles/:rolname",
  async ({ params, signal }) => {
    const rolname = params.rolname;
    const response = await fetch(`/.internal/database/api/roles/${rolname}`, {
      signal,
    });
    if (!response.ok) {
      const error = await response.json();
      const getRoleError = new Error(`Failed to get role: ${error.message}`);
      getRoleError.stack = error.stack || error.message;
      throw getRoleError;
    }
    const { role, databases, columns } = await response.json();
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
      `/.internal/database/api/roles/${rolname}/${columnName}`,
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
        `Failed to update role: ${error.message}`,
      );
      updateRoleError.stack = error.stack || error.message;
      throw updateRoleError;
    }
    roleStore.upsert("rolname", rolname, { [columnName]: value });
  },
);

export const POST_ROLE_ACTION = registerAction(async ({ signal, formData }) => {
  const rolname = formData.get("rolname");
  const response = await fetch(`/.internal/database/api/roles`, {
    signal,
    method: "POST",
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({ rolname }),
  });
  if (!response.ok) {
    const error = await response.json();
    const createRoleError = new Error(
      `Failed to create role: ${error.message}`,
    );
    createRoleError.stack = error.stack || error.message;
    throw createRoleError;
  }
  const role = await response.json();
  roleStore.upsert(role);
});

export const DELETE_ROLE_ACTION = registerAction(
  async ({ rolname, signal }) => {
    const response = await fetch(`/.internal/database/api/roles/${rolname}`, {
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
        `Failed to delete role: ${error.message}`,
      );
      deleteRoleError.stack = error.stack || error.message;
      throw deleteRoleError;
    }
    roleStore.drop("rolname", rolname);
  },
);
