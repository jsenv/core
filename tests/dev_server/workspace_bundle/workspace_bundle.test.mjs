import { startDevServer } from "@jsenv/core";
import { executePageFunction } from "@jsenv/core/tests/execute_page_function.js";
import { launchBrowserPage } from "@jsenv/core/tests/launch_browser_page.js";
import { snapshotDevTests } from "@jsenv/core/tests/snapshot_dev_tests.js";
import {
  ensureEmptyDirectory,
  replaceFileStructureSync,
  writeFileSync,
  writeSymbolicLinkSync,
} from "@jsenv/filesystem";
import { chromium } from "playwright";

if (process.env.CI) {
  process.exit(0);
}

writeSymbolicLinkSync({
  from: import.meta.resolve("./fixtures/node_modules/foo/"),
  to: import.meta.resolve("./fixtures/packages/foo/"),
  allowUseless: true,
});
writeSymbolicLinkSync({
  from: import.meta.resolve("./fixtures/node_modules/bar/"),
  to: import.meta.resolve("./fixtures/packages/bar/"),
  allowUseless: true,
});
const sourceDirectoryUrl = new URL("./git_ignored/", import.meta.url);
replaceFileStructureSync({
  from: new URL("./fixtures/", import.meta.url),
  to: sourceDirectoryUrl,
});
// restore the symlinks (replaceFileStructureSync does not preserve them)
writeSymbolicLinkSync({
  from: import.meta.resolve("./git_ignored/node_modules/foo/"),
  to: import.meta.resolve("./git_ignored/packages/foo/"),
  allowOverwrite: true,
});
writeSymbolicLinkSync({
  from: import.meta.resolve("./git_ignored/node_modules/bar/"),
  to: import.meta.resolve("./git_ignored/packages/bar/"),
  allowOverwrite: true,
});
await ensureEmptyDirectory(new URL("./.jsenv/", import.meta.url));
const devServer = await startDevServer({
  sourcemaps: "none",
  logLevel: "warn",
  serverLogLevel: "warn",
  sourceDirectoryUrl,
  outDirectoryUrl: import.meta.resolve("./.jsenv/"),
  keepProcessAlive: true,
  clientAutoreloadOnServerRestart: false,
  dropToOpen: false,
  supervisor: false,
  ribbon: false,
  clientAutoreload: false,
});

let debug = false;
const run = async () => {
  const browser = await chromium.launch({
    ignoreHTTPSErrors: true,
    headless: !debug,
  });
  const page = await launchBrowserPage(browser, { pageErrorEffect: "log" });
  await page.setViewportSize({ width: 900, height: 550 }); // generate smaller screenshots
  await page.goto(`${devServer.origin}/main.html`);
  const firstResult = await executePageFunction(page);
  writeFileSync(
    new URL("./git_ignored/packages/foo/answer.js", import.meta.url),
    `export const answer = 41;`,
  );
  await new Promise((r) => setTimeout(r, 300));
  await page.reload();
  const afterUpdateResult = await executePageFunction(page);
  if (!debug) {
    page.close();
    browser.close();
  }

  return {
    firstReturnValue: firstResult.returnValue,
    afterUpdateReturnValue: afterUpdateResult.returnValue,
  };
};

await snapshotDevTests(
  import.meta.url,
  ({ test }) => {
    test("0_basic", () => run());
  },
  {
    logEffects: false,
  },
);

if (!debug) {
  devServer.stop(); // required because for some reason the rooms are kept alive
}
