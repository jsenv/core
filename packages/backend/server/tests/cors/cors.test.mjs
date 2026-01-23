import {
  jsenvServiceCORS,
  jsenvServiceErrorHandler,
  startServer,
} from "@jsenv/server";
import { snapshotServerTests } from "@jsenv/server/tests/test_helpers.mjs";

const run = async ({ cors, triggerInternalError }) => {
  const server = await startServer({
    logLevel: "warn",
    keepProcessAlive: false,
    services: [
      ...(cors
        ? [
            jsenvServiceCORS({
              accessControlAllowRequestOrigin: true,
              accessControlAllowRequestMethod: true,
              accessControlAllowRequestHeaders: true,
              accessControlAllowedMethods: [],
              accessControlMaxAge: 400,
            }),
          ]
        : []),
      jsenvServiceErrorHandler(),
      {
        redirectRequest: () => {
          if (triggerInternalError) {
            throw new Error("here");
          }
        },
        routes: [
          {
            endpoint: "GET *",
            fetch: () => {
              return new Response("ok");
            },
          },
        ],
      },
    ],
  });

  const response = await fetch(server.origin, {
    method: "OPTIONS",
    headers: {
      "accept": "text/plain",
      "origin": "http://example.com:80",
      "access-control-request-method": "GET",
      "access-control-request-headers": "x-whatever",
    },
  });
  const actual = {
    status: response.status,
    headers: Object.fromEntries(response.headers),
    body: await response.text(),
  };
  return actual;
};

await snapshotServerTests(import.meta.url, ({ test }) => {
  test("0_without_cors", async () => {
    return run({ cors: false });
  });
  test("1_error_without_cors", async () => {
    return run({ cors: false, triggerInternalError: true });
  });
  test("2_with_cors", async () => {
    return run({ cors: true });
  });
  test("3_error_with_cors", async () => {
    return run({ cors: true, triggerInternalError: true });
  });
});
