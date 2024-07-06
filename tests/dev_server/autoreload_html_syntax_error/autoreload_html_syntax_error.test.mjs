/*
 * Test the following:
 * - Ensure adding/removing a syntax error in html is gracefully handled
 *   (no waiting forever for importmap to load and js properly executes)
 */

import { writeFileSync } from "node:fs";
import { chromium } from "playwright";
import {
  writeFileStructureSync,
  ensureEmptyDirectorySync,
} from "@jsenv/filesystem";

import { startDevServer } from "@jsenv/core";

let debug = false;
const sourceDirectoryUrl = new URL("./git_ignored/", import.meta.url);
const snapshotsDirectoryUrl = new URL("./snapshots/", import.meta.url);
const writeFileStructureForScenario = (scenario) => {
  const scenarioDirectoryUrl = new URL(`./${scenario}/`, import.meta.url);
  writeFileStructureSync(sourceDirectoryUrl, scenarioDirectoryUrl);
};
ensureEmptyDirectorySync(snapshotsDirectoryUrl);
writeFileStructureForScenario("0_at_start");

const devServer = await startDevServer({
  logLevel: "off",
  serverLogLevel: "off",
  sourceDirectoryUrl,
  keepProcessAlive: !debug,
  port: 0,
});
const browser = await chromium.launch({
  headless: !debug,
  devtools: debug,
});
const page = await browser.newPage({ ignoreHTTPSErrors: true });
await page.setViewportSize({ width: 600, height: 300 }); // set a relatively small and predicatble size
const takeScreenshot = async (scenario) => {
  const sceenshotBuffer = await page.screenshot();
  writeFileSync(
    new URL(`./${scenario}.png`, snapshotsDirectoryUrl),
    sceenshotBuffer,
  );
};
const testScenario = async (scenario) => {
  const scenarioDirectoryUrl = new URL(`./${scenario}/`, import.meta.url);
  writeFileStructureSync(sourceDirectoryUrl, scenarioDirectoryUrl);
  await new Promise((resolve) => setTimeout(resolve, 500));
  await takeScreenshot(scenario);
};

try {
  await page.goto(`${devServer.origin}/main.html`);
  await takeScreenshot("0_at_start");
  // await testScenario("1_add_syntax_error");
  // await testScenario("2_fix_syntax_error");
} finally {
  if (!debug) {
    browser.close();
    devServer.stop();
  }
}
