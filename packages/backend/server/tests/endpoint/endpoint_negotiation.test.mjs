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
  // not mandatory but allow to avoir having to omany server opened in parallel for this test
  // also we set a listeners to SIGHUP when starting a server and starting too many server in parallel
  // triggers process maxListeners warning from Node.js
  apiServer.stop();
  return actual;
};

await snapshotTests(
  import.meta.url,
  ({ test }) => {
    test("0_basic_content_type", async () => {
      const routes = [
        {
          endpoint: "GET /users",
          availableMediaTypes: ["application/json", "text/plain"],
          fetch: (request, { contentNegotiation }) => {
            if (contentNegotiation.mediaType === "application/json") {
              return Response.json({ data: "Hello" });
            }
            return new Response("Hello");
          },
        },
      ];
      return {
        "GET users without accept header": await run({
          routes,
          method: "GET",
          path: "/users",
          headers: {},
        }),
        "GET users accepting text/css": await run({
          routes,
          method: "GET",
          path: "/users",
          headers: {
            accept: "text/css",
          },
        }),
        "GET users accepting anything": await run({
          routes,
          method: "GET",
          path: "/users",
          headers: {
            accept: "*/*",
          },
        }),
        "GET users accepting json": await run({
          routes,
          method: "GET",
          path: "/users",
          headers: {
            accept: "application/json",
          },
        }),
        "GET users accepting textual responses": await run({
          routes,
          method: "GET",
          path: "/users",
          headers: {
            accept: "text/*",
          },
        }),
      };
    });

    test("1_basic_language", async () => {
      const routes = [
        {
          endpoint: "GET /users",
          availableLanguages: ["fr"],
          fetch: () => {
            return new Response("Bonjour", {
              headers: { "content-language": "fr" },
            });
          },
        },
        {
          endpoint: "GET /users",
          availableLanguages: ["en"],
          fetch: () => {
            return new Response("Hello", {
              headers: { "content-language": "en" },
            });
          },
        },
      ];
      return {
        "GET users without accept-language header": await run({
          routes,
          method: "GET",
          path: "/users",
          headers: {},
        }),
        "GET users accepting DE language": await run({
          routes,
          method: "GET",
          path: "/users",
          headers: {
            "accept-language": "de",
          },
        }),
        "GET users accepting FR language": await run({
          routes,
          method: "GET",
          path: "/users",
          headers: {
            "accept-language": "fr",
          },
        }),
        "GET users accepting EN language": await run({
          routes,
          method: "GET",
          path: "/users",
          headers: {
            "accept-language": "en",
          },
        }),
      };
    });

    test("2_multiple", async () => {
      const routes = [
        {
          endpoint: "GET /users",
          availableMediaTypes: ["application/json", "text/plain"],
          availableLanguages: ["fr", "en"],
          fetch: (request, { contentNegotiation }) => {
            const message =
              contentNegotiation.language === "fr" ? "Bonjour" : "Hello";
            const headers = {
              "content-language": contentNegotiation.language,
            };
            if (contentNegotiation.mediaType === "application/json") {
              return Response.json({ message }, { headers });
            }
            return new Response(message, { headers });
          },
        },
      ];
      return {
        "GET users accepting css and language DE": await run({
          routes,
          method: "GET",
          path: "/users",
          headers: {
            "accept": "text/css",
            "accept-language": "de",
          },
        }),
        "GET users accepting text and language FR": await run({
          routes,
          method: "GET",
          path: "/users",
          headers: {
            "accept": "text/plain",
            "accept-language": "fr",
          },
        }),
      };
    });

    test("3_versioning", async () => {
      const routes = [
        {
          endpoint: "GET /users",
          availableVersions: [(value) => parseInt(value) > 2],
          fetch: () =>
            new Response("latest users", {
              headers: { "content-version": "3" },
            }),
        },
        {
          endpoint: "GET /users",
          availableVersions: ["alpha"],
          fetch: () =>
            new Response("alpha users", {
              headers: { "content-version": "alpha" },
            }),
        },
        {
          endpoint: "GET /users",
          availableVersions: [1],
          fetch: () =>
            new Response("users v1", {
              headers: { "content-version": "1" },
            }),
        },
        {
          endpoint: "GET /users",
          availableVersions: [2],
          fetch: () =>
            new Response("users v2", {
              headers: { "content-version": "2" },
            }),
        },
      ];
      return {
        "GET /users without setting accept-version": await run({
          routes,
          method: "GET",
          path: "/users",
        }),
        "GET /users accepting any version": await run({
          routes,
          method: "GET",
          path: "/users",
          headers: {
            "accept-version": "*",
          },
        }),
        "GET /users accepting alpha version": await run({
          routes,
          method: "GET",
          path: "/users",
          headers: {
            "accept-version": "alpha",
          },
        }),
        "GET /users accepting version 1": await run({
          routes,
          method: "GET",
          path: "/users",
          headers: {
            "accept-version": "1",
          },
        }),
        "GET /users accepting version 2": await run({
          routes,
          method: "GET",
          path: "/users",
          headers: {
            "accept-version": "2",
          },
        }),
        "GET /users accepting version 3": await run({
          routes,
          method: "GET",
          path: "/users",
          headers: {
            "accept-version": "3",
          },
        }),
      };
    });
  },
  {
    logEffects: {
      prevent: true,
    },
  },
);
