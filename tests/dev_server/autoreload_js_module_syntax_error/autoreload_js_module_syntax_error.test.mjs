/*
 * Test the following:
 * - a script[hot-accept] can hot reload when supervised
 * - Introducing a syntax error displays the error overlay
 * - Fixing the syntax error removes the error overlay
 */

import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { assert } from "@jsenv/assert";

import { startDevServer } from "@jsenv/core";

let debug = false;
const jsFileUrl = new URL("./client/main.js", import.meta.url);
const jsFileContent = {
  beforeTest: readFileSync(jsFileUrl),
  update: (content) => writeFileSync(jsFileUrl, content),
  restore: () => writeFileSync(jsFileUrl, jsFileContent.beforeTest),
};
const devServer = await startDevServer({
  logLevel: "off",
  serverLogLevel: "off",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  keepProcessAlive: !debug,
  port: 0,
});

const browser = await chromium.launch({ headless: !debug });
const page = await browser.newPage({ ignoreHTTPSErrors: true });

try {
  await page.goto(`${devServer.origin}/main.html`);
  const getErrorOverlayDisplayedOnPage = async (page) => {
    const errorOverlayHandle = await page.evaluate(
      /* eslint-disable no-undef */
      () => document.querySelector("jsenv-error-overlay"),
      /* eslint-enable no-undef */
    );
    return Boolean(errorOverlayHandle);
  };
  {
    const actual = {
      displayed: await getErrorOverlayDisplayedOnPage(page),
    };
    const expect = {
      displayed: false,
    };
    assert({ actual, expect });
  }

  jsFileContent.update(`const j = (`);
  await new Promise((resolve) => {
    setTimeout(resolve, 500);
  });
  {
    const actual = {
      displayedAfterSyntaxError: await getErrorOverlayDisplayedOnPage(page),
    };
    const expect = {
      displayedAfterSyntaxError: true,
    };
    assert({ actual, expect });
  }
  jsFileContent.update(`const j = true`);
  await new Promise((resolve) => {
    setTimeout(resolve, 500);
  });
  {
    const actual = {
      displayedAfterFixAndAutoreload:
        await getErrorOverlayDisplayedOnPage(page),
    };
    const expect = {
      displayedAfterFixAndAutoreload: false,
    };
    assert({ actual, expect });
  }
} finally {
  jsFileContent.restore();
  if (!debug) {
    browser.close();
    devServer.stop(); // required because for some reason the rooms are kept alive
  }
}
