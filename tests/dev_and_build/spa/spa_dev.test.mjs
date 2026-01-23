import { startDevServer } from "@jsenv/core";
import { executeHtml } from "@jsenv/core/tests/execute_html.js";
import { snapshotDevTests } from "@jsenv/core/tests/snapshot_dev_tests.js";
import { chromium, firefox } from "playwright";

const run = async ({ browserLauncher }) => {
  const devServer = await startDevServer({
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    keepProcessAlive: false,
    port: 0,
  });
  const fromRoot = await executeHtml(`${devServer.origin}/index.html`, {
    browserLauncher,
  });
  const fromDeepRoute = await executeHtml(`${devServer.origin}/foo/bar`, {
    browserLauncher,
  });
  return { fromRoot, fromDeepRoute };
};

await snapshotDevTests(import.meta.url, ({ test }) => {
  test("0_chromium", () => run({ browserLauncher: chromium }));
  test("1_firefox", () => run({ browserLauncher: firefox }));
});
