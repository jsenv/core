/*
 * Test the following:
 * Ensure fetching an HTML file that does not exists display a fallback html
 * Autoreload works when adding the file
 * (to be confirmed) autoreload when adding an other file
 *
 * - TODO: test in a subdirectory
 * - TODO: test when dir is empty
 * - TODO: test "/404.js"
 * - TODO in an other test: quite the same but for syntax error in html
 */

import { writeFileSync } from "node:fs";
import { chromium } from "playwright";
import {
  writeFileStructureSync,
  ensureEmptyDirectorySync,
} from "@jsenv/filesystem";
import { takeDirectorySnapshot } from "@jsenv/snapshot";

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
  const directorySnapshot = takeDirectorySnapshot(snapshotsDirectoryUrl);
  await page.goto(`${devServer.origin}`);
  await takeScreenshot("0_at_start");
  await testScenario("1_fix_404");
  await testScenario("2_update");
  await testScenario("3_back_to_404");
  directorySnapshot.compare();
} finally {
  if (!debug) {
    browser.close();
    devServer.stop();
  }
}
