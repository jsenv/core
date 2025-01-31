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
    plugins: [
      jsenvPluginPreact({
        refreshInstrumentation: true,
      }),
    ],
    clientAutoreload: false,
    ribbon: false,
    supervisor: false,
    directoryListing: false,
  });
  const withoutSearch = await executeHtml(`${devServer.origin}/main.html`, {
    browserLauncher,
  });
  const withSearch = await executeHtml(`${devServer.origin}/main.html?foo`, {
    browserLauncher,
  });
  return {
    withoutSearch,
    withSearch,
  };
};

await snapshotDevSideEffects(import.meta.url, ({ test }) => {
  test("0_chromium", () => run({ browserLauncher: chromium }));
});
