import { startDevServer } from "@jsenv/core";
import { executePageFunction } from "@jsenv/core/tests/execute_page_function.js";
import { launchBrowserPage } from "@jsenv/core/tests/launch_browser_page.js";
import { snapshotDevTests } from "@jsenv/core/tests/snapshot_dev_tests.js";
import {
  ensureEmptyDirectory,
  writeFileSync,
  writeSymbolicLinkSync,
} from "@jsenv/filesystem";
import { chromium } from "playwright";

if (process.env.CI) {
  process.exit(0);
}

let debug = false;
writeSymbolicLinkSync({
  from: import.meta.resolve("./client/node_modules/foo/"),
  to: import.meta.resolve("./client/packages/foo/"),
  allowUseless: true,
});
writeSymbolicLinkSync({
  from: import.meta.resolve("./client/node_modules/bar/"),
  to: import.meta.resolve("./client/packages/bar/"),
  allowUseless: true,
});
await ensureEmptyDirectory(new URL("./.jsenv/", import.meta.url));
const devServer = await startDevServer({
  sourcemaps: "none",
  logLevel: "warn",
  serverLogLevel: "warn",
  sourceDirectoryUrl: import.meta.resolve("./client/"),
  outDirectoryUrl: import.meta.resolve("./.jsenv/"),
  keepProcessAlive: true,
  port: 8888,
  clientAutoreloadOnServerRestart: false,
  dropToOpen: false,
  supervisor: false,
  ribbon: false,
  clientAutoreload: false,
});

const run = async () => {
  const browser = await chromium.launch({
    ignoreHTTPSErrors: true,
    headless: !debug,
  });
  const page = await launchBrowserPage(browser, { pageErrorEffect: "log" });
  await page.setViewportSize({ width: 900, height: 550 }); // generate smaller screenshots
  await page.goto(`${devServer.origin}/main.html`);
  const startResult = await executePageFunction(page);
  writeFileSync(
    new URL("./client/packages/foo/answer.js", import.meta.url),
    `export const answer = 41;`,
  );
  const afterUpdateResult = await executePageFunction(page);

  if (!debug) {
    page.close();
    browser.close();
  }

  return { startResult, afterUpdateResult };
};

await snapshotDevTests(import.meta.url, ({ test }) => {
  test("0_basic", () => run());
});

if (!debug) {
  devServer.stop(); // required because for some reason the rooms are kept alive
}
