import { startServer } from "@jsenv/server";
import { snapshotTests } from "@jsenv/snapshot";
import { fetchUsingNodeBuiltin } from "../test_helpers.mjs";

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

await snapshotTests(import.meta.url, ({ test }) => {
  test("0_basic", async () => {
    const routes = [
      {
        endpoint: "GET /",
      },
      {
        acceptedContentTypes: ["text/plain"],
        endpoint: "PATCH /",
      },
      {
        acceptedContentTypes: ["application/json"],
        endpoint: "POST /",
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
