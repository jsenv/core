/*
 * The goal of this file is to:
 * - See the effect of using jsenv dev server on source files
 *
 * consider https://testrigor.com/blog/websocketerror-in-playwright/
 */

import { startDevServer } from "@jsenv/core";
import { launchBrowserPage } from "@jsenv/core/tests/launch_browser_page.js";
import { snapshotDevSideEffects } from "@jsenv/core/tests/snapshot_dev_side_effects.js";
import { ensureEmptyDirectory, writeFileSync } from "@jsenv/filesystem";
import { jsenvPluginToolbar } from "@jsenv/plugin-toolbar";
import { chromium } from "playwright";

if (process.env.CI) {
  process.exit(0);
  // for some reason when runned on CI or by executeTestPlan
  // the websocket connection fails and jsenv toolbar cannot be injected
  // that would fail the test
}

let debug = false;
const run = async () => {
  await ensureEmptyDirectory(new URL("./.jsenv/", import.meta.url));
  const devServer = await startDevServer({
    sourcemaps: "none",
    logLevel: "warn",
    serverLogLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    keepProcessAlive: true,
    port: 8888,
    plugins: [jsenvPluginToolbar({ logLevel: "debug" })],
    // ribbon: false,
    // clientAutoreload: false,
  });
  const browser = await chromium.launch({
    ignoreHTTPSErrors: true,
    headless: !debug,
  });
  const page = await launchBrowserPage(browser, { pageErrorEffect: "log" });
  if (debug) {
    page.on("websocket", (websocket) => {
      websocket.on("close", () => console.log("WebSocket closed"));
      websocket.on("error", (error) =>
        console.error("WebSocket error:", error.message),
      );
    });
  }
  await page.goto(`${devServer.origin}/main.html`);
  await new Promise((resolve) => setTimeout(resolve, 800)); // wait a bit for toolbar injection
  const html = await page.content();
  writeFileSync(new URL("./main_after_exec.html", import.meta.url), html);
  if (!debug) {
    browser.close();
    devServer.stop(); // required because for some reason the rooms are kept alive
  }
};

await snapshotDevSideEffects(import.meta.url, ({ test }) => {
  test("0_basic", () => run());
});
