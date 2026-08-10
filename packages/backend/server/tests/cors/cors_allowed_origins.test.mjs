import { serverPluginCORS, startServer } from "@jsenv/server";
import { snapshotServerTests } from "@jsenv/server/tests/test_helpers.mjs";

const run = async ({
  origin,
  accessControlAllowedOrigins = [
    "http://localhost:3400",
    "https://wematch-web.fly.dev",
  ],
  accessControlAllowRequestOrigin = false,
}) => {
  const server = await startServer({
    logLevel: "warn",
    keepProcessAlive: false,
    plugins: [
      serverPluginCORS({
        accessControlAllowedOrigins,
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

  const wildcardAllowedOrigins = [
    "http://localhost:3400",
    "https://pr-*-wematch.fly.dev",
  ];
  test("wildcard_allowed_origins", async () => {
    return {
      literal_origin: await run({
        origin: "http://localhost:3400",
        accessControlAllowedOrigins: wildcardAllowedOrigins,
      }),
      origin_matching_wildcard: await run({
        origin: "https://pr-12-wematch.fly.dev",
        accessControlAllowedOrigins: wildcardAllowedOrigins,
      }),
      origin_not_matching_wildcard: await run({
        origin: "https://pr-12-other.fly.dev",
        accessControlAllowedOrigins: wildcardAllowedOrigins,
      }),
      // "." in the pattern stays literal
      origin_replacing_dot: await run({
        origin: "https://pr-12-wematchXfly.dev",
        accessControlAllowedOrigins: wildcardAllowedOrigins,
      }),
      // the wildcard must not cross a "/" nor match beyond the end
      origin_with_path_prefix: await run({
        origin: "https://evil.com/pr-12-wematch.fly.dev",
        accessControlAllowedOrigins: wildcardAllowedOrigins,
      }),
      origin_with_suffix: await run({
        origin: "https://pr-12-wematch.fly.dev.evil.com",
        accessControlAllowedOrigins: wildcardAllowedOrigins,
      }),
      subdomain_wildcard: await run({
        origin: "https://wematch.fly.dev",
        accessControlAllowedOrigins: ["https://*.fly.dev"],
      }),
      // no literal origin to fall back on, "*" is sent instead of the pattern
      disallowed_origin_when_only_wildcards: await run({
        origin: "http://evil.com",
        accessControlAllowedOrigins: ["https://*.fly.dev"],
      }),
    };
  });
});
