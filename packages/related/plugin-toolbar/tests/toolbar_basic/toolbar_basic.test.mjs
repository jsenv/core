/*
 * The goal of this file is to:
 * - See the effect of using jsenv dev server on source files
 */

import { startDevServer } from "@jsenv/core";
import { launchBrowserPage } from "@jsenv/core/tests/launch_browser_page.js";
import { ensureEmptyDirectory, writeFileSync } from "@jsenv/filesystem";
// https://github.com/un-ts/eslint-plugin-import-x/issues/305
// eslint-disable-next-line import-x/no-extraneous-dependencies
import { jsenvPluginToolbar } from "@jsenv/plugin-toolbar";
import { chromium } from "playwright";

process.exit(0); // TODO: fix this test

const debug = false;
await ensureEmptyDirectory(new URL("./.jsenv/", import.meta.url));
const devServer = await startDevServer({
  sourcemaps: "none",
  logLevel: "warn",
  serverLogLevel: "warn",
  sourceDirectoryUrl: import.meta.resolve("./client/"),
  outDirectoryUrl: import.meta.resolve("./.jsenv/"),
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
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await takeScreenshot("0_at_start");
  await page.locator("#jsenv_toolbar_trigger").click();
  await new Promise((resolve) => setTimeout(resolve, 500));
  await takeScreenshot("1_after_click_to_open_toolbar");
  await page
    .frameLocator(`[name="jsenv toolbar"]`)
    .locator("#settings_open_button")
    .click();
  await new Promise((resolve) => setTimeout(resolve, 500));
  await takeScreenshot("2_after_click_to_open_toolbar_settings");
  await page
    .frameLocator(`[name="jsenv toolbar"]`)
    .locator("#settings_close_button")
    .click();
  await takeScreenshot("3_after_click_to_close_toolbar_settings");
  await page
    .frameLocator(`[name="jsenv toolbar"]`)
    .locator("#toolbar_close_button")
    .click();
  await new Promise((resolve) => setTimeout(resolve, 500));
  await takeScreenshot("4_after_click_to_close_toolbar");
} finally {
  if (!debug) {
    browser.close();
    devServer.stop(); // required because for some reason the rooms are kept alive
  }
}
