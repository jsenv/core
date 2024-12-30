import { startDevServer } from "@jsenv/core";
import { replaceFileStructureSync, writeFileSync } from "@jsenv/filesystem";
import { chromium } from "playwright";

let debug = false;
const projectDirectoryUrl = new URL("./git_ignored/", import.meta.url);
const sourceDirectoryUrl = new URL("./git_ignored/src/", import.meta.url);
const snapshotsDirectoryUrl = new URL("./snapshots/", import.meta.url);
replaceFileStructureSync({
  from: new URL("./fixtures/0_at_start/", import.meta.url),
  to: projectDirectoryUrl,
});

const devServer = await startDevServer({
  logLevel: "off",
  serverLogLevel: "off",
  sourceDirectoryUrl,
  keepProcessAlive: !debug,
  directoryListingUrlMocks: true,
  clientAutoreload: false,
  port: 0,
});
const browser = await chromium.launch({
  headless: !debug,
  devtools: debug,
});
const page = await browser.newPage({ ignoreHTTPSErrors: true });
await page.setViewportSize({ width: 800, height: 500 }); // set a relatively small and predicatble size
const takeScreenshot = async (scenario) => {
  const sceenshotBuffer = await page.screenshot();
  writeFileSync(
    new URL(`./${scenario}.png`, snapshotsDirectoryUrl),
    sceenshotBuffer,
  );
};

try {
  await page.goto(`${devServer.origin}`);
  await takeScreenshot("0_at_start");
  await page.locator(`a:text-matches("../packages/")`).click();
  await takeScreenshot("1_after_click_packages");
} finally {
  if (!debug) {
    browser.close();
    devServer.stop();
  }
}
