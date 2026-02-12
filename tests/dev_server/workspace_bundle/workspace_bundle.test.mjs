import { startDevServer } from "@jsenv/core";
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

writeSymbolicLinkSync({
  from: import.meta.resolve("./client/node_modules/foo/"),
  to: import.meta.resolve("./client/packages/foo/"),
});
writeSymbolicLinkSync({
  from: import.meta.resolve("./client/node_modules/bar/"),
  to: import.meta.resolve("./client/packages/bar/"),
});

let debug = false;
const run = async () => {
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
    // ribbon: false,
    // clientAutoreload: false,
  });
  const browser = await chromium.launch({
    ignoreHTTPSErrors: true,
    headless: !debug,
  });
  const page = await launchBrowserPage(browser, { pageErrorEffect: "log" });
  await page.goto(`${devServer.origin}/main.html`);
  await new Promise((resolve) => setTimeout(resolve, 800)); // wait a bit
  writeFileSync(
    new URL("./client/packages/foo/answer.js", import.meta.url),
    `export const answer = 41;`,
  );
  if (!debug) {
    page.close();
    browser.close();
    devServer.stop(); // required because for some reason the rooms are kept alive
  }
};

await snapshotDevTests(import.meta.url, ({ test }) => {
  test("0_basic", () => run());
});
