import { startDevServer } from "@jsenv/core";
import { executeHtml } from "@jsenv/core/tests/execute_html.js";
import { snapshotDevTests } from "@jsenv/core/tests/snapshot_dev_tests.js";
import { chromium } from "playwright";

const run = async () => {
  const devServer = await startDevServer({
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    keepProcessAlive: false,
    port: 0,
  });
  return executeHtml(`${devServer.origin}/index.html`);
};

await snapshotDevTests(import.meta.url, ({ test }) => {
  test("chromium", () => run({ browserLauncher: chromium }));
});
