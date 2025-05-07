import { registerRoute, registerAction, goTo } from "@jsenv/router";
import { setRoleColumns, updateRole } from "./role_signals.js";

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
    updateRole(role.rolname, role);
  },
);

export const PUT_ROLE_ACTION = registerAction(
  async ({ roleName, columnName, formData, signal }) => {
    throw new Error("here");
    let value = formData.get("value");
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
    updateRole(roleName, { [columnName]: value });
    if (
      columnName === "rolname" &&
      GET_ROLE_ROUTE.isMatchingSignal.peek() &&
      GET_ROLE_ROUTE.params.roleName === roleName
    ) {
      const roleUrl = GET_ROLE_ROUTE.buildUrl(window.location.href, {
        roleName: value,
      });
      goTo(roleUrl, { replace: true });
    }
  },
);
