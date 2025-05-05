import { registerRoute } from "@jsenv/router";

export const GET_USER_ROUTE = registerRoute({
  "GET /.internal/database/users/:name": async ({ params, signal }) => {
    const name = params.name;
    const response = await fetch(`/.internal/database/api/users/${name}`, {
      signal,
    });
    const data = await response.json();
    return data;
  },
});

export const PUT_USER_ROUTE = registerRoute({
  "PUT /.internal/database/api/users/:columnName": async ({
    params,
    formData,
  }) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const columnName = params.columnName;
    const value = formData.get("value");
    const response = await fetch(
      `/.internal/database/api/users/${columnName}`,
      {
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
});
