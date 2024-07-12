/*
 * The goal of this file is to:
 * - See the effect of using jsenv dev server on source files
 */

import { chromium } from "playwright";
import { writeFileSync, ensureEmptyDirectory } from "@jsenv/filesystem";

import { startDevServer } from "@jsenv/core";
import { jsenvPluginToolbar } from "@jsenv/plugin-toolbar";
import { launchBrowserPage } from "@jsenv/core/tests/launch_browser_page.js";

const debug = false;
await ensureEmptyDirectory(new URL("./.jsenv/", import.meta.url));
const devServer = await startDevServer({
  sourcemaps: "none",
  logLevel: "off",
  serverLogLevel: "off",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
  keepProcessAlive: false,
  port: 0,
  plugins: [jsenvPluginToolbar()],
});

const browser = await chromium.launch({
  headless: !debug,
  devtools: debug,
});
const page = await launchBrowserPage(browser, { pageErrorEffect: "log" });
await page.setViewportSize({ width: 600, height: 300 }); // set a relatively small and predicatble size
const takeScreenshot = async (scenario) => {
  const sceenshotBuffer = await page.screenshot();
  writeFileSync(
    new URL(`./output/${scenario}.png`, import.meta.url),
    sceenshotBuffer,
  );
};

try {
  await page.goto(`${devServer.origin}/main.html`);
  await takeScreenshot("0_at_start");
} finally {
  if (!debug) {
    browser.close();
    devServer.stop(); // required because for some reason the rooms are kept alive
  }
}
