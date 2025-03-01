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
        availableContentTypes: ["application/json", "text/plain"],
        response: (request, { contentNegotiation }) => {
          if (contentNegotiation.contentType === "application/json") {
            return Response.json({ data: "Hello" });
          }
          return new Response("Hello");
        },
      },
    ];
    return {
      "GET /users with accept: text/css": await run({
        routes,
        method: "GET",
        path: "/users",
        headers: {
          accept: "text/css",
        },
      }),
      "GET /users with accept: anything": await run({
        routes,
        method: "GET",
        path: "/users",
        headers: {
          accept: "*/*",
        },
      }),
      "GET /users with accept: application/json": await run({
        routes,
        method: "GET",
        path: "/users",
        headers: {
          accept: "application/json",
        },
      }),
      "GET /users with accept: text/*": await run({
        routes,
        method: "GET",
        path: "/users",
        headers: {
          accept: "text/*",
        },
      }),
    };
  });
});
