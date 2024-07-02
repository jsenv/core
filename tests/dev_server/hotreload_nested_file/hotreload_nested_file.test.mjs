/*
 * Test the following:
 * when a nested file is modified
 * the change is propagated so that it's re-executed
 */

import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { assert } from "@jsenv/assert";

import { startDevServer } from "@jsenv/core";

const debug = false;
const jsFileUrl = new URL("./client/b.js", import.meta.url);
const jsFileContent = {
  beforeTest: readFileSync(jsFileUrl),
  update: (content) => writeFileSync(jsFileUrl, content),
  restore: () => writeFileSync(jsFileUrl, jsFileContent.beforeTest),
};
const devServer = await startDevServer({
  logLevel: "off",
  serverLogLevel: "off",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
  keepProcessAlive: false,
  port: 0,
});

const browser = await chromium.launch({ headless: !debug });
const page = await browser.newPage({ ignoreHTTPSErrors: true });

try {
  await page.goto(`${devServer.origin}/main.html`);
  const getDocumentBodyInnerHTML = () => {
    return page.evaluate(
      /* eslint-disable no-undef */
      () => document.body.innerHTML,
      /* eslint-enable no-undef */
    );
  };

  {
    const actual = await getDocumentBodyInnerHTML();
    const expect = `init`;
    assert({ actual, expect });
  }

  jsFileContent.update(`export const value = "after_update";`);
  // wait for hot reload
  await new Promise((resolve) => setTimeout(resolve, 500));
  {
    const actual = await getDocumentBodyInnerHTML();
    const expect = `after_update`;
    assert({ actual, expect });
  }
  jsFileContent.restore();
  // wait for hot reload
  await new Promise((resolve) => setTimeout(resolve, 500));
  {
    const actual = await getDocumentBodyInnerHTML();
    const expect = `init`;

    assert({ actual, expect });
  }
} finally {
  jsFileContent.restore();
  if (!debug) {
    browser.close();
    devServer.stop(); // required because for some reason the rooms are kept alive
  }
}
