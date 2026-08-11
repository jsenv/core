/*
 * An injection in html is substituted as-is, so it can be concatenated with
 * surrounding text: "__BACKEND_URL__/users/me" -> "https://api.example.com/users/me".
 * In an inline <script> it becomes a JS literal instead, which is how the value
 * reaches every js file of the page (window.backendUrl).
 *
 * The attribute case exists mostly for resource hints (<link rel="preconnect">,
 * <link rel="preload">), but the executed page below demoes it on a plain
 * data-* attribute: a resource hint would make the browser hit the network.
 * Resource hints are covered by the second test, which only builds.
 */

import { build, startBuildServer } from "@jsenv/core";
import { executeHtml } from "@jsenv/core/tests/execute_html.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_tests.js";

const buildClient = async (clientDirectoryUrl) => {
  await build({
    sourceDirectoryUrl: clientDirectoryUrl,
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: {
      "./main.html": {
        bundling: false,
        minification: false,
        injections: {
          "./main.html": () => {
            return {
              __BACKEND_URL__: "https://api.example.com",
            };
          },
        },
      },
    },
  });
};

const run = async () => {
  await buildClient(import.meta.resolve("./client/"));
  const buildServer = await startBuildServer({
    buildDirectoryUrl: import.meta.resolve("./build/"),
    keepProcessAlive: false,
    port: 0,
  });
  return executeHtml(`${buildServer.origin}/main.html`);
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("backend_url_shared", () => run());
  test("backend_url_in_resource_hints", () =>
    buildClient(import.meta.resolve("./client_resource_hints/")));
});
