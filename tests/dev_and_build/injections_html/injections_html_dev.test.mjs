/*
 * Same client and same injections as injections_html_build.test.mjs, served by the
 * dev server: the placeholder must be substituted while developping too, and the
 * value can differ from the build one (a local api instead of the deployed one).
 */

import { INJECTIONS, startDevServer } from "@jsenv/core";
import { executeHtml } from "@jsenv/core/tests/execute_html.js";
import { snapshotDevTests } from "@jsenv/core/tests/snapshot_dev_tests.js";
import { chromium } from "playwright";

const run = async () => {
  const devServer = await startDevServer({
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    injections: {
      "./main.html": () => {
        return {
          // a real project points this on the api it runs locally
          // ("https://localhost:4000"); a snapshot cannot, ports and localhost
          // are normalized out of it
          __BACKEND_URL__: "https://api.dev.example.com",
          appVersion: INJECTIONS.global("1.2.3"),
        };
      },
    },
    keepProcessAlive: false,
    port: 0,
  });
  return executeHtml(`${devServer.origin}/main.html`);
};

await snapshotDevTests(import.meta.url, ({ test }) => {
  test("chromium", () => run({ browserLauncher: chromium }));
});
