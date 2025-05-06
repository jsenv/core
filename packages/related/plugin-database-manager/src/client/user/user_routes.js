import { registerRoute, registerAction } from "@jsenv/router";

export const GET_USER_ROUTE = registerRoute(
  "/.internal/database/users/:name",
  async ({ params, signal }) => {
    const name = params.name;
    const response = await fetch(`/.internal/database/api/users/${name}`, {
      signal,
    });
    const data = await response.json();
    return data;
  },
);

export const PUT_USER_ACTION = registerAction(
  async ({ columnName, formData, signal }) => {
    await new Promise((resolve) => setTimeout(resolve, 100000));
    const value = formData.get("value");
    const response = await fetch(
      `/.internal/database/api/users/${columnName}`,
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
      throw new Error(
        `Failed to update user: ${response.status} ${response.statusText}`,
      );
    }
  },
);
