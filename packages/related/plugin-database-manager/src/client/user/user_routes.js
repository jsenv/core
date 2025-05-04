export const userRoutes = {
  "GET /.internal/database/users/:name": async ({ params, signal }) => {
    const name = params.name;
    const response = await fetch(`/.internal/database/api/users/${name}`, {
      signal,
    });
    const data = await response.json();
    return data;
  },
};
