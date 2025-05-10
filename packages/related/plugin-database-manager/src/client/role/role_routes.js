import { registerRoute, registerAction, goTo } from "@jsenv/router";
import { computed } from "@preact/signals";
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
    roleStore.upsert(role.rolname, role);
  },
);
const activeRoleSignal = computed(() => {
  const isMatching = GET_ROLE_ROUTE.isMatchingSignal.value;
  const params = GET_ROLE_ROUTE.paramsSignal.value;
  return isMatching ? roleStore.select("rolname", params.roleName) : null;
});
roleStore.propertyChangeEffect(activeRoleSignal, "rolname", (rolname) => {
  const roleUrl = GET_ROLE_ROUTE.buildUrl(window.location.href, {
    roleName: rolname,
  });
  goTo(roleUrl, { replace: true });
});
roleStore.deleteEffect(activeRoleSignal, () => {
  goTo(GET_ROLE_ROUTE.url, { replace: true });
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
    roleStore.upsert(roleName, { [columnName]: value });
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
    roleStore.drop(roleName);
  },
);
