import { registerRoute, registerAction } from "@jsenv/router";
import { connectStoreAndRoute } from "@jsenv/sigi";
import { roleStore, setRoleColumns } from "./role_signals.js";

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
    roleStore.upsert(role);
  },
);

connectStoreAndRoute(roleStore, GET_ROLE_ROUTE, {
  itemKey: "rolname",
  paramKey: "roleName",
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
    roleStore.upsert("rolname", roleName, { [columnName]: value });
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
  roleStore.upsert(role);
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
    roleStore.drop("rolname", roleName);
  },
);
