/*
 * Test the following:
 * Ensure fetching an HTML file that does not exists display a fallback html
 * Autoreload works when adding the file
 * (to be confirmed) autoreload when adding an other file
 *
 * - TODO: test "/404.js"
 * - TODO: test when dir is empty
 * - TODO in an other test: check what happens for syntax error
 */

import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { writeFileStructureSync } from "@jsenv/filesystem";
// import { assert } from "@jsenv/assert";

import { startDevServer } from "@jsenv/core";

let debug = true;
const sourceDirectoryUrl = new URL("./ignored/", import.meta.url);
const atStartDirectoryUrl = new URL("./0_at_start/", import.meta.url);
writeFileStructureSync(sourceDirectoryUrl, atStartDirectoryUrl);
const devServer = await startDevServer({
  logLevel: "off",
  serverLogLevel: "off",
  sourceDirectoryUrl,
  keepProcessAlive: !debug,
  port: 0,
});

const browser = await chromium.launch({ headless: !debug, devtools: debug });
const page = await browser.newPage({ ignoreHTTPSErrors: true });
await page.setViewportSize({ width: 600, height: 300 }); // set a relatively small and predicatble size
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
  await takeScreenshot("0_root_url.png");
  await takePageSnapshot("0_root_url.html");
  writeFileSync(
    new URL("./index.html", sourceDirectoryUrl),
    readFileSync(new URL("./1_other/index.html", import.meta.url)),
  );
  await new Promise((resolve) => setTimeout(resolve, 500));
  // await page.goto(`${devServer.origin}/404.html`);
  // await takeScreenshot("1_404.html.png");
  // await takePageSnapshot("1_404.html.html");
  // await page.goto(`${devServer.origin}/dir/404.html`);
  // await takeScreenshot("2_dir_404.html.png");
  // await takePageSnapshot("2_dir_404.html.html");
} finally {
  if (!debug) {
    browser.close();
    devServer.stop();
  }
}
