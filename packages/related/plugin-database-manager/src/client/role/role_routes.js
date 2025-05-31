import { registerAction, registerRoute } from "@jsenv/router";
import { connectStoreAndRoute } from "@jsenv/sigi";
import {
  setActiveRole,
  setActiveRoleColumns,
  setActiveRoleDatabases,
} from "./role_signals.js";
import { roleStore } from "./role_store.js";

const errorFromResponse = async (response, message) => {
  const serverErrorInfo = await response.json();
  let serverMessage =
    typeof serverErrorInfo === "string"
      ? serverErrorInfo
      : serverErrorInfo.message;
  let errorMessage = message ? `${message}: ${serverMessage}` : serverMessage;
  const error = new Error(errorMessage);
  if (serverErrorInfo && typeof serverErrorInfo === "object") {
    error.stack = serverErrorInfo.stack || serverErrorInfo.message;
  }
  throw error;
};

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

export const POST_ROLE_ACTION = registerAction(async ({ signal, formData }) => {
  const rolname = formData.get("rolname");
  const response = await fetch(`${window.DB_MANAGER_CONFIG.apiUrl}/roles`, {
    signal,
    method: "POST",
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({ rolname }),
  });
  if (!response.ok) {
    throw await errorFromResponse(response, "Failed to create role");
  }
  const role = await response.json();
  roleStore.upsert(role);
});

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
    roleStore.drop("rolname", rolname);
  },
);
