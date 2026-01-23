import { startServer } from "@jsenv/server";
import {
  fetchUsingNodeBuiltin,
  snapshotServerTests,
} from "@jsenv/server/tests/test_helpers.mjs";

const run = async ({ routes, method, path }) => {
  const apiServer = await startServer({
    logLevel: "warn",
    routes,
    keepProcessAlive: false,
  });
  const response = await fetchUsingNodeBuiltin(apiServer.origin, {
    method,
    path,
  });
  const actual = {
    status: response.status,
    headers: Object.fromEntries(response.headers),
    body: await response.text(),
  };
  return actual;
};

await snapshotServerTests(import.meta.url, ({ test }) => {
  test("0_basic", async () => {
    const routes = [
      {
        endpoint: "GET /",
        fetch: () => {},
      },
      {
        acceptedMediaTypes: ["text/plain"],
        endpoint: "PATCH /",
        fetch: () => {},
      },
      {
        acceptedMediaTypes: ["application/json"],
        endpoint: "POST /",
        fetch: () => {},
      },
    ];

    return {
      "/": await run({
        routes,
        method: "OPTIONS",
        path: "/",
      }),
      "*": await run({
        routes,
        method: "OPTIONS",
        path: "*",
      }),
    };
  });
});
