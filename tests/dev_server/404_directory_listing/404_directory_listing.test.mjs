/*
 * Things to test here:
 * - "/" list source directory content
 *   - and jsenv banner is displayed + autoreload works
 * - "/404.html" list source directory content
 *   - and jsenv banner is displayed + autoreload works
 * - same for "/dir/404.html"
 * - "/404.js" does nothing special
 *
 * - TODO: improve the page message
 *   404 http://localhost:5674/404.html
 *   No entry on the filesystem at file:///Users/damien.maillard/dev/perso/jsenv-core/tests/dev_server/404_directory_listing/client/404.html
 *
 *   See following files are availables in file:///Users/damien.maillard/dev/perso/jsenv-core/tests/dev_server/404_directory_listing/client/:
 *   - dir/
 *   - main.html
 * - TODO in an other test: check what happens for syntax error
 */

import { writeFileSync } from "node:fs";
import { chromium } from "playwright";
// import { assert } from "@jsenv/assert";

import { startDevServer } from "@jsenv/core";

let debug = false;
const sourceDirectoryUrl = new URL("./client/", import.meta.url);
const devServer = await startDevServer({
  logLevel: "off",
  serverLogLevel: "off",
  sourceDirectoryUrl,
  keepProcessAlive: !debug,
  port: 0,
});

const browser = await chromium.launch({ headless: !debug });
const page = await browser.newPage({ ignoreHTTPSErrors: true });
await page.setViewportSize({ width: 400, height: 200 }); // set a relatively small and predicatble size
const takeScreenshot = async (name) => {
  const sceenshotBuffer = await page.screenshot();
  writeFileSync(
    new URL(`./screenshots/${name}`, import.meta.url),
    sceenshotBuffer,
  );
};
const takePageSnapshot = async (name) => {
  const html = await page.content();
  writeFileSync(new URL(`./snapshots/${name}`, import.meta.url), html);
};

try {
  await page.goto(`${devServer.origin}`);
  await takeScreenshot("root_url.png");
  await takePageSnapshot("root_url.html");
  await page.goto(`${devServer.origin}/404.html`);
  await takeScreenshot("404.html.png");
  await takePageSnapshot("404.html.html");
  await page.goto(`${devServer.origin}/dir/404.html`);
  await takeScreenshot("dir_404.html.png");
  await takePageSnapshot("dir_404.html.html");
} finally {
  if (!debug) {
    browser.close();
    devServer.stop();
  }
}
