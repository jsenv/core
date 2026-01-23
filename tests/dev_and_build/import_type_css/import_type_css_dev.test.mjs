import { startDevServer } from "@jsenv/core";
import { executeHtml } from "@jsenv/core/tests/execute_html.js";
import { snapshotDevTests } from "@jsenv/core/tests/snapshot_dev_tests.js";
import { chromium, firefox } from "playwright";

// page.goto: NS_ERROR_CONNECTION_REFUSED happens a lot with windows + firefox here
if (process.platform === "win32") {
  process.exit(0);
}

const run = async () => {
  const devServer = await startDevServer({
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    keepProcessAlive: false,
    port: 0,
  });
  return executeHtml(`${devServer.origin}/main.html`);
};

await snapshotDevTests(import.meta.url, ({ test }) => {
  test("0_chromium", () => run({ browserLauncher: chromium }));
  test("1_firefox", () => run({ browserLauncher: firefox }));
});
