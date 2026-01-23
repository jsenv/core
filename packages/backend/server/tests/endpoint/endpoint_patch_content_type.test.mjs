import { startServer } from "@jsenv/server";
import {
  fetchUsingNodeBuiltin,
  snapshotServerTests,
} from "@jsenv/server/tests/test_helpers.mjs";

const run = async ({ routes, method, path, headers, body }) => {
  const apiServer = await startServer({
    logLevel: "error",
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

await snapshotServerTests(import.meta.url, ({ test }) => {
  test("0_basic", async () => {
    const routes = [
      {
        acceptedMediaTypes: ["text/plain"],
        endpoint: "PATCH /",
        fetch: async (request) => {
          const text = await request.text();
          return new Response(text.toUpperCase());
        },
      },
    ];
    return {
      "PATCH / without content-type": await run({
        routes,
        method: "PATCH",
        path: "/",
        headers: {},
        body: `<xml></xml>`,
      }),
      "PATCH / with xml": await run({
        routes,
        method: "PATCH",
        path: "/",
        headers: {
          "content-type": "application/xml",
        },
        body: `<xml></xml>`,
      }),
      "PATCH / with text": await run({
        routes,
        method: "PATCH",
        path: "/",
        headers: {
          "content-type": "text/plain",
        },
        body: `Hello world`,
      }),
    };
  });
});
