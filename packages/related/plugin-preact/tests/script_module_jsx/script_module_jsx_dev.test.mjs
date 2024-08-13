import { startDevServer } from "@jsenv/core";
import { executeHtml } from "@jsenv/core/tests/execute_html.js";
import { snapshotDevSideEffects } from "@jsenv/core/tests/snapshot_dev_side_effects.js";
import { jsenvPluginPreact } from "@jsenv/plugin-preact";
import { chromium } from "playwright";

const run = async ({ browserLauncher }) => {
  const devServer = await startDevServer({
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    keepProcessAlive: false,
    port: 0,
    plugins: [jsenvPluginPreact()],
  });
  return executeHtml(`${devServer.origin}/main.html`, {
    browserLauncher,
  });
};

await snapshotDevSideEffects(import.meta.url, ({ test }) => {
  test("0_chromium", () => run({ browserLauncher: chromium }));
});
