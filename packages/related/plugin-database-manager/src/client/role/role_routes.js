import { registerRoute, registerAction } from "@jsenv/router";

export const GET_ROLE_ROUTE = registerRoute(
  "/.internal/database/roles/:roleName",
  async ({ params, signal }) => {
    const roleName = params.roleName;
    const response = await fetch(`/.internal/database/api/roles/${roleName}`, {
      signal,
    });
    const data = await response.json();
    return data;
  },
);

export const PUT_ROLE_ACTION = registerAction(
  async ({ roleName, columnName, formData, signal }) => {
    const value = formData.get("value");
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
      updateRoleError.stack = error.stack;
      throw updateRoleError;
    }
  },
);
