/*
 * Test the following:
 * - importmap resolution applies correctly from a file
 * - updating importmap trigger autoreload + correctly update resolution
 */

import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { assert } from "@jsenv/assert";

import { startDevServer } from "@jsenv/core";

const importmapFileUrl = new URL("./client/main.importmap", import.meta.url);
const importmapFileContent = {
  beforeTest: readFileSync(importmapFileUrl),
  update: (content) => writeFileSync(importmapFileUrl, content),
  restore: () =>
    writeFileSync(importmapFileUrl, importmapFileContent.beforeTest),
};
const devServer = await startDevServer({
  logLevel: "warn",
  serverLogLevel: "warn",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
  keepProcessAlive: false,
  port: 0,
});

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ ignoreHTTPSErrors: true });

try {
  await page.goto(`${devServer.origin}/main.html`);
  const getWindowAnswer = () => {
    return page.evaluate(
      /* eslint-disable no-undef */
      () => window.answer,
      /* eslint-enable no-undef */
    );
  };

  {
    const actual = await getWindowAnswer();
    const expect = 42;
    assert({ actual, expect });
  }

  const pageReloadPromise = page.waitForNavigation();
  importmapFileContent.update(`{
    "imports": {
      "a": "./b.js"
    }
}`);
  await pageReloadPromise;
  {
    const actual = await getWindowAnswer();
    const expect = "b";
    assert({ actual, expect });
  }
  importmapFileContent.restore();
  await new Promise((resolve) => setTimeout(resolve, 500));
  {
    const actual = await getWindowAnswer();
    const expect = 42;
    assert({ actual, expect });
  }
} finally {
  importmapFileContent.restore();
  browser.close();
  devServer.stop(); // required because for some reason the rooms are kept alive
}
