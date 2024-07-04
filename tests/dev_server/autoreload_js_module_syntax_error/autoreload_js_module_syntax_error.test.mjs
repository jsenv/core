/*
 * Test the following:
 * - a script[hot-accept] can hot reload when supervised
 * - Introducing a syntax error displays the error overlay
 * - Fixing the syntax error removes the error overlay
 */

import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

import { startDevServer } from "@jsenv/core";
import {
  assertErrorOverlayNotDisplayed,
  assertErrorOverlayDisplayed,
} from "../error_overlay_test_helpers.js";

let debug = false;
const jsFileUrl = new URL("./client/main.js", import.meta.url);
const jsFileContent = {
  beforeTest: readFileSync(jsFileUrl),
  update: (content) => writeFileSync(jsFileUrl, content),
  restore: () => writeFileSync(jsFileUrl, jsFileContent.beforeTest),
};
const devServer = await startDevServer({
  logLevel: "off",
  serverLogLevel: "off",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  keepProcessAlive: !debug,
  port: 0,
});

const browser = await chromium.launch({ headless: !debug });
const page = await browser.newPage({ ignoreHTTPSErrors: true });

try {
  await page.goto(`${devServer.origin}/main.html`);
  await assertErrorOverlayNotDisplayed(page);
  jsFileContent.update(`const j = (`);
  await new Promise((resolve) => setTimeout(resolve, 500));
  await assertErrorOverlayDisplayed(page, "after_syntax_error");
  jsFileContent.update(`const j = true`);
  await new Promise((resolve) => setTimeout(resolve, 500));
  await assertErrorOverlayNotDisplayed(page, "after_fix_and_autoreload");
} finally {
  jsFileContent.restore();
  if (!debug) {
    browser.close();
    devServer.stop(); // required because for some reason the rooms are kept alive
  }
}
