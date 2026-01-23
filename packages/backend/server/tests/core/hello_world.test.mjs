import { startServer } from "@jsenv/server";
import { snapshotServerTests } from "@jsenv/server/tests/test_helpers.mjs";

const run = async () => {
  const server = await startServer({
    logLevel: "warn",
    keepProcessAlive: false,
    routes: [
      {
        endpoint: "GET /",
        fetch: () => {
          return new Response("hello world");
        },
      },
    ],
  });
  const response = await fetch(server.origin);
  const actual = {
    status: response.status,
    headers: Object.fromEntries(response.headers),
    body: await response.text(),
  };
  return actual;
};

await snapshotServerTests(import.meta.url, ({ test }) => {
  test("0_basic", async () => {
    return run({ cors: false });
  });
});
