/*
 * Things to test here:
 * - "/" list source directory content
 *   - and jsenv banner is displayed + autoreload works
 * - "/404.html" list source directory content
 *   - and jsenv banner is displayed + autoreload works
 * - same for "/dir/404.html"
 * - "/404.js" does nothing special
 *
 * - what happens when serving a directory? It would be great to have autoreload here too?
 * so we would need something special
 *
 * - TODO in an other test: check what happens for syntax error
 */

/*
 * Test the following:
 * - Ensure adding/removing a syntax error in html is gracefully handled
 *   (no waiting forever for importmap to load and js properly executes)
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
  //   await page.goto(`${devServer.origin}/404.html`);
  //   await takeScreenshot("404.html.png");
  //   await takePageSnapshot("404.html.html");
  //   await page.goto(`${devServer.origin}/dir/404.html`);
  //   await takeScreenshot("dir_404.html.png");
  //   await takePageSnapshot("dir_404.html.html");
} finally {
  if (!debug) {
    browser.close();
    devServer.stop();
  }
}
