import { startDevServer } from "@jsenv/core";
import { executeHtml } from "@jsenv/core/tests/execute_html.js";
import { snapshotDevTests } from "@jsenv/core/tests/snapshot_dev_tests.js";
import { jsenvPluginReact } from "@jsenv/plugin-react";
import { chromium, firefox } from "playwright";

// if (process.platform === "win32") {
process.exit(0);
// }

const run = async ({ browserLauncher }) => {
  const devServer = await startDevServer({
    plugins: [jsenvPluginReact({ asJsModuleLogLevel: "warn" })],
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    keepProcessAlive: false,
    port: 0,
  });
  return executeHtml(`${devServer.origin}/main.html`, {
    browserLauncher,
  });
};

await snapshotDevTests(import.meta.url, ({ test }) => {
  test("0_chromium", () => run({ browserLauncher: chromium }));
  test("1_firefox", () => run({ browserLauncher: firefox }));
});
