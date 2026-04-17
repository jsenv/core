import { serverPluginCORS, startServer } from "@jsenv/server";
import { snapshotServerTests } from "@jsenv/server/tests/test_helpers.mjs";

const run = async ({ origin, accessControlAllowRequestOrigin = false }) => {
  const server = await startServer({
    logLevel: "warn",
    keepProcessAlive: false,
    plugins: [
      serverPluginCORS({
        accessControlAllowedOrigins: [
          "http://localhost:3400",
          "https://wematch-web.fly.dev",
        ],
        accessControlAllowRequestOrigin,
      }),
      {
        routes: [
          {
            endpoint: "GET *",
            fetch: () => new Response("ok"),
          },
        ],
      },
    ],
  });

  const headers = { accept: "text/plain" };
  if (origin) {
    headers.origin = origin;
  }
  const response = await fetch(server.origin, { headers });
  await server.stop();
  return Object.fromEntries(response.headers);
};

await snapshotServerTests(import.meta.url, ({ test }) => {
  test("multiple_allowed_origins", async () => {
    return {
      allowed_origin_first: await run({ origin: "http://localhost:3400" }),
      allowed_origin_second: await run({
        origin: "https://wematch-web.fly.dev",
      }),
      disallowed_origin: await run({ origin: "http://evil.com" }),
      no_origin_header: await run({ origin: null }),
      allowed_origin_with_allow_request_origin: await run({
        origin: "http://localhost:3400",
        accessControlAllowRequestOrigin: true,
      }),
      unlisted_origin_with_allow_request_origin: await run({
        origin: "http://unknown.com",
        accessControlAllowRequestOrigin: true,
      }),
    };
  });
});
