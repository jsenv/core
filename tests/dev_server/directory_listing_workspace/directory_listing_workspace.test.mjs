import { startDevServer } from "@jsenv/core";
import { replaceFileStructureSync, writeFileSync } from "@jsenv/filesystem";
import { jsenvPluginPreact } from "@jsenv/plugin-preact";
import { chromium } from "playwright";

let debug = false;
const projectDirectoryUrl = import.meta.resolve("./git_ignored/");
const sourceDirectoryUrl = import.meta.resolve("./git_ignored/src/");
const snapshotsDirectoryUrl = import.meta.resolve("./snapshots/");
replaceFileStructureSync({
  from: new URL("./fixtures/0_at_start/", import.meta.url),
  to: projectDirectoryUrl,
});

const devServer = await startDevServer({
  logLevel: "off",
  serverLogLevel: "off",
  sourceDirectoryUrl,
  keepProcessAlive: !debug,
  directoryListing: {
    urlMocks: true,
  },
  clientAutoreload: false,
  plugins: [jsenvPluginPreact()],
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
  await page.locator(`a[href$="git_ignored/"]`).click();
  await takeScreenshot("1_after_click_git_ignored");
  await page.locator(`a[href$="git_ignored/packages/"]`).click();
  await takeScreenshot("1_after_click_packages");
} finally {
  if (!debug) {
    browser.close();
    devServer.stop();
  }
}
