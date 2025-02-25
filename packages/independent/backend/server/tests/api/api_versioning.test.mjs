// TODO: ability to pass a callback for the value like accept-version: (v) => parseInt(v) <2

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
        headers: { "accept-version": "*" },
        response: () =>
          new Response("users latest", {
            headers: {
              "content-version": "2",
            },
          }),
      },
    ];
    return {
      "GET /users without accept-version": await run({
        routes,
        method: "GET",
        path: "/",
      }),
      "GET /users with accept-version: 1": await run({
        routes,
        method: "GET",
        path: "/",
      }),
      "GET /users with accept-version: 2": await run({
        routes,
        method: "GET",
        path: "/",
      }),
    };
  });
});
