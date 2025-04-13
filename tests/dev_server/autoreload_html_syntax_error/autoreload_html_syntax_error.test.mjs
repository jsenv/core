/*
 * Test the following:
 * - Ensure adding/removing a syntax error in html is gracefully handled
 *   (no waiting forever for importmap to load and js properly executes)
 */

import { startDevServer } from "@jsenv/core";
import {
  ensureEmptyDirectorySync,
  replaceFileStructureSync,
} from "@jsenv/filesystem";
import { takeDirectorySnapshot } from "@jsenv/snapshot";
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";

let debug = false;
const sourceDirectoryUrl = import.meta.resolve("./git_ignored/");
const outputDirectoryUrl = import.meta.resolve("./output/");
const writeFileStructureForScenario = (scenario) => {
  const scenarioDirectoryUrl = import.meta.resolve(`./${scenario}/`);
  replaceFileStructureSync({
    from: scenarioDirectoryUrl,
    to: sourceDirectoryUrl,
  });
};
ensureEmptyDirectorySync(outputDirectoryUrl);
writeFileStructureForScenario("0_at_start");

const devServer = await startDevServer({
  logLevel: "off",
  serverLogLevel: "off",
  sourceDirectoryUrl,
  keepProcessAlive: !debug,
  outDirectoryUrl: import.meta.resolve("./.jsenv/"),
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
    new URL(`./${scenario}.png`, outputDirectoryUrl),
    sceenshotBuffer,
  );
};
const testScenario = async (scenario) => {
  const scenarioDirectoryUrl = import.meta.resolve(`./${scenario}/`);
  replaceFileStructureSync({
    from: scenarioDirectoryUrl,
    to: sourceDirectoryUrl,
  });
  await new Promise((resolve) => setTimeout(resolve, 500));
  await takeScreenshot(scenario);
};

try {
  const outputDirectorySnapshot = takeDirectorySnapshot(outputDirectoryUrl);
  await page.goto(`${devServer.origin}/main.html`);
  await takeScreenshot("0_at_start");
  await testScenario("1_add_syntax_error");
  await testScenario("2_fix_syntax_error");
  await testScenario("3_update_js");
  await testScenario("4_back_to_syntax_error");
  outputDirectorySnapshot.compare();
} finally {
  if (!debug) {
    browser.close();
    devServer.stop();
  }
}
