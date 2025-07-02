import { startDevServer } from "@jsenv/core";
import { executeHtml } from "@jsenv/core/tests/execute_html.js";
import { snapshotDevSideEffects } from "@jsenv/core/tests/snapshot_dev_side_effects.js";
import { jsenvPluginCommonJs } from "@jsenv/plugin-commonjs";
import { chromium } from "playwright";

if (process.platform === "win32") {
  process.exit(0);
}

const run = async ({ browserLauncher }) => {
  const devServer = await startDevServer({
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    keepProcessAlive: false,
    port: 0,
    plugins: [
      jsenvPluginCommonJs({
        include: {
          "./lib/": true,
        },
      }),
    ],
  });
  return executeHtml(`${devServer.origin}/main.html`, {
    browserLauncher,
  });
};

await snapshotDevSideEffects(import.meta.url, ({ test }) => {
  test("0_chromium", () => run({ browserLauncher: chromium }));
});
