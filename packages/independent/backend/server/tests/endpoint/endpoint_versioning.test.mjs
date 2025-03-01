import { startServer } from "@jsenv/server";
import { snapshotTests } from "@jsenv/snapshot";
import { fetchUsingNodeBuiltin } from "../test_helpers.mjs";

const run = async ({ routes, method, path, headers, body }) => {
  const apiServer = await startServer({
    logLevel: "warn",
    routes,
    keepProcessAlive: false,
  });
  const response = await fetchUsingNodeBuiltin(apiServer.origin, {
    method,
    path,
    headers,
    body,
  });
  const actual = {
    status: response.status,
    headers: Object.fromEntries(response.headers),
    body: await response.text(),
  };
  return actual;
};

await snapshotTests(import.meta.url, ({ test }) => {
  test("0_basic", async () => {
    const routes = [
      {
        endpoint: "GET /users",
        headers: { "accept-version": "1" },
        response: () =>
          new Response("users v1", {
            headers: { "content-version": "1" },
          }),
      },
      {
        endpoint: "GET /users",
        headers: { "accept-version": (v) => parseInt(v) === 2 },
        response: () =>
          new Response("users v2", {
            headers: { "content-version": "2" },
          }),
      },
      {
        endpoint: "GET /users",
        headers: { "accept-version": "*" },
        response: () =>
          new Response("latest users", {
            headers: { "content-version": "3" },
          }),
      },
    ];
    return {
      "GET /users without accept-version": await run({
        routes,
        method: "GET",
        path: "/users",
      }),
      "GET /users with accept-version: 1": await run({
        routes,
        method: "GET",
        path: "/users",
        headers: {
          "accept-version": "1",
        },
      }),
      "GET /users with accept-version: 2": await run({
        routes,
        method: "GET",
        path: "/users",
        headers: {
          "accept-version": "2",
        },
      }),
      "GET /users with accept-version: 3": await run({
        routes,
        method: "GET",
        path: "/users",
        headers: {
          "accept-version": "3",
        },
      }),
    };
  });
});
