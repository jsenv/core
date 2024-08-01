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

await snapshotDevSideEffects(import.meta.url, ({ test }) => {
  const run = async () => {
    const debug = false;
    await ensureEmptyDirectory(new URL("./.jsenv/", import.meta.url));
    const devServer = await startDevServer({
      sourcemaps: "none",
      logLevel: "warn",
      serverLogLevel: "warn",
      sourceDirectoryUrl: new URL("./client/", import.meta.url),
      outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
      keepProcessAlive: false,
      port: 0,
      plugins: [jsenvPluginToolbar()],
      // ribbon: false,
      // clientAutoreload: false,
    });
    const browser = await chromium.launch({ headless: !debug });
    const page = await launchBrowserPage(browser, { pageErrorEffect: "log" });
    await page.goto(`${devServer.origin}/main.html`);
    const html = await page.content();
    writeFileSync(new URL("./main_after_exec.html", import.meta.url), html);
    if (!debug) {
      browser.close();
      devServer.stop(); // required because for some reason the rooms are kept alive
    }
  };

  test("0_basic", async () => {
    await run();
  });
});
