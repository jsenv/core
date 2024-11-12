/*
 * Test the following:
 * - a script[hot-accept] can hot reload when supervised
 * - Introducing a syntax error displays the error overlay
 * - Fixing the syntax error removes the error overlay
 */

import { startDevServer } from "@jsenv/core";
import { replaceFileStructureSync, writeFileSync } from "@jsenv/filesystem";
import { snapshotTests } from "@jsenv/snapshot";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

let debug = false;
const sourceDirectoryUrl = new URL("./git_ignored/", import.meta.url);
replaceFileStructureSync({
  from: new URL("./0_at_start/", import.meta.url),
  to: sourceDirectoryUrl,
});
const devServer = await startDevServer({
  logLevel: "off",
  serverLogLevel: "off",
  sourceDirectoryUrl,
  keepProcessAlive: !debug,
  port: 0,
});

const run = async () => {
  const browser = await chromium.launch({ headless: !debug });
  const page = await browser.newPage({ ignoreHTTPSErrors: true });
  await page.setViewportSize({ width: 900, height: 550 }); // generate smaller screenshots
  const takeScreenshot = async (scenario) => {
    const sceenshotBuffer = await page.screenshot();
    writeFileSync(
      new URL(`./screenshots/${scenario}.png`, import.meta.url),
      sceenshotBuffer,
    );
  };

  const mainJsFileUrl = new URL("./main.js", sourceDirectoryUrl);
  await page.goto(`${devServer.origin}/main.html`);
  await takeScreenshot("at_start");
  writeFileSync(
    mainJsFileUrl,
    readFileSync(
      new URL("./1_syntax_error/js_syntax_error.js", import.meta.url),
    ),
  );
  await new Promise((resolve) => setTimeout(resolve, 500));
  await takeScreenshot("after_syntax_error");
  writeFileSync(
    mainJsFileUrl,
    readFileSync(new URL("./2_fix_syntax_error/main.js", import.meta.url)),
  );
  await new Promise((resolve) => setTimeout(resolve, 500));
  await takeScreenshot("after_fix_and_autoreload");

  if (!debug) {
    await browser.close();
  }
};

await snapshotTests(
  import.meta.url,
  ({ test }) => {
    test("0_chromium", () => run());
  },
  {
    filesystemActions: {
      "**/.jsenv/": "ignore",
      "**/git_ignored/": "ignore",
      "**/*.png": "compare_presence_only",
    },
  },
);

if (!debug) {
  await devServer.stop(); // required because for some reason the rooms are kept alive
}
