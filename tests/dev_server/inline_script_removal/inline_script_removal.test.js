/*
 Ensure dev server behaviour when fetching inline js files
 */

import { assert } from "@jsenv/assert";
import { writeFileSync } from "@jsenv/filesystem";
import { takeDirectorySnapshot } from "@jsenv/snapshot";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

import { startDevServer } from "@jsenv/core";
import { launchBrowserPage } from "@jsenv/core/tests/launch_browser_page.js";

let debug = false;
const sourceDirectoryUrl = new URL("./git_ignored/", import.meta.url);
const outputDirectoryUrl = new URL("./output/", import.meta.url);
const sourceHtmlFileUrl = new URL("./git_ignored/main.html", import.meta.url);
writeFileSync(
  sourceHtmlFileUrl,
  readFileSync(new URL("./fixtures/0_at_start.html", import.meta.url)),
);
const devServer = await startDevServer({
  logLevel: "off",
  serverLogLevel: "error",
  sourceDirectoryUrl,
  keepProcessAlive: false,
  clientAutoreload: {
    cooldownBetweenFileEvents: 250,
  },
  outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
  port: 0,
});
const browser = await chromium.launch({ headless: !debug });
const page = await launchBrowserPage(browser, {
  mirrorConsole: true,
  pageErrorEffect: "none",
});
await page.setViewportSize({ width: 600, height: 450 }); // set a relatively small and predicatble size
const takeScreenshot = async (scenario) => {
  const sceenshotBuffer = await page.screenshot();
  writeFileSync(
    new URL(`./${scenario}.png`, outputDirectoryUrl),
    sceenshotBuffer,
  );
};
const testScenario = async (scenario) => {
  writeFileSync(
    sourceHtmlFileUrl,
    readFileSync(new URL(`./fixtures/${scenario}.html`, import.meta.url)),
  );
  await new Promise((resolve) => setTimeout(resolve, 500));
  await takeScreenshot(scenario);
};

const getResponseForInlineScript = async () => {
  const response = await fetch(`${devServer.origin}/main.html@L11C5-L13C14.js`);
  const status = response.status;
  const headers = Object.fromEntries(response.headers.entries());
  return { status, headers };
};

try {
  await page.goto(`${devServer.origin}/main.html`);
  const outputDirectorySnapshot = takeDirectorySnapshot(outputDirectoryUrl);
  await takeScreenshot("0_at_start");
  const responseAtStart = await getResponseForInlineScript();
  assert({
    actual: responseAtStart.status,
    expect: 404,
  });
  await testScenario("1_inline_removed");
  const responseAfterRemoval = await getResponseForInlineScript();
  assert({
    actual: responseAfterRemoval.status,
    expect: 404,
  });
  outputDirectorySnapshot.compare();
} finally {
  if (!debug) {
    browser.close();
  }
}
