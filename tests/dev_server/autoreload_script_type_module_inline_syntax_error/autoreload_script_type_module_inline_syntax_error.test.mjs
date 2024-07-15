import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { writeFileSync } from "@jsenv/filesystem";
import { takeDirectorySnapshot } from "@jsenv/snapshot";

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
  sourceDirectoryUrl,
  keepProcessAlive: false,
  clientAutoreload: {
    cooldownBetweenFileEvents: 250,
  },
  supervisor: {
    errorBaseUrl: "file:///mock/",
  },
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

try {
  await page.goto(`${devServer.origin}/main.html`);
  const outputDirectorySnapshot = takeDirectorySnapshot(outputDirectoryUrl);
  await takeScreenshot("0_at_start");
  await testScenario("1_add_syntax_error");
  await testScenario("2_other_syntax_error");
  await testScenario("3_fix_syntax_error");
  outputDirectorySnapshot.compare();
} finally {
  if (!debug) {
    browser.close();
  }
}
