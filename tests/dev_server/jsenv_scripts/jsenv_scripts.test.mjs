/*
 */

import prettier from "prettier";
import { chromium } from "playwright";
import { writeFileSync } from "@jsenv/filesystem";
import { takeDirectorySnapshot } from "@jsenv/snapshot";

import { startDevServer } from "@jsenv/core";

const debug = false;
const devServer = await startDevServer({
  logLevel: "off",
  serverLogLevel: "off",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
  keepProcessAlive: false,
  port: 0,
});

const browser = await chromium.launch({ headless: !debug });
const page = await browser.newPage({ ignoreHTTPSErrors: true });

try {
  await page.goto(`${devServer.origin}/main.html`);
  const testOutputDirectorySnapshot = takeDirectorySnapshot(
    new URL("./output/", import.meta.url),
  );
  const html = await page.content();
  const htmlFormatted = await prettier.format(html, {
    parser: "html",
  });
  writeFileSync(new URL("./output/main.html", import.meta.url), htmlFormatted);
  testOutputDirectorySnapshot.compare();
} finally {
  if (!debug) {
    browser.close();
    devServer.stop(); // required because for some reason the rooms are kept alive
  }
}
