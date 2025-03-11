/*
 * Test the following:
 * - A non deterministic plugin error while cooking inline style does not prevent
 * - browser from displaying the underlying html + css in that <style>
 */

import { assert } from "@jsenv/assert";
import { startDevServer } from "@jsenv/core";
import { replaceFileStructureSync } from "@jsenv/filesystem";
import { chromium } from "playwright";

const sourceDirectoryUrl = new URL("./git_ignored/", import.meta.url);
replaceFileStructureSync({
  from: new URL("./fixtures/0_at_start/", import.meta.url),
  to: sourceDirectoryUrl,
});
const devServer = await startDevServer({
  logLevel: "off",
  serverLogLevel: "off",
  sourceDirectoryUrl,
  outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
  keepProcessAlive: false,
  port: 0,
  plugins: [
    {
      transformUrlContent: {
        css: (urlInfo) => {
          if (urlInfo.content.includes("yellow")) {
            throw new Error("here");
          }
        },
      },
    },
  ],
  clientAutoreload: false,
  ribbon: false,
  supervisor: false,
});

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ ignoreHTTPSErrors: true });
const getDocumentBodyBackgroundColor = () => {
  return page.evaluate(
    /* eslint-disable no-undef */
    () => window.getComputedStyle(document.body).backgroundColor,
    /* eslint-enable no-undef */
  );
};

try {
  await page.goto(`${devServer.origin}/main.html`);
  const atStart = await getDocumentBodyBackgroundColor();
  replaceFileStructureSync({
    from: new URL("./fixtures/1_update/", import.meta.url),
    to: sourceDirectoryUrl,
  });
  await new Promise((resolve) => setTimeout(resolve, 200));
  await page.reload();
  const afterUpdateToYellow = await getDocumentBodyBackgroundColor();
  replaceFileStructureSync({
    from: new URL("./fixtures/0_at_start/", import.meta.url),
    to: sourceDirectoryUrl,
  });
  await new Promise((resolve) => setTimeout(resolve, 200));
  await page.reload();
  const afterRestore = await getDocumentBodyBackgroundColor();
  assert({
    actual: {
      atStart,
      afterUpdateToYellow,
      afterRestore,
    },
    expect: {
      atStart: `rgb(0, 128, 0)`,
      afterUpdateToYellow: `rgb(255, 255, 0)`,
      afterRestore: `rgb(0, 128, 0)`,
    },
  });
} finally {
  browser.close();
  devServer.stop(); // required because for some reason the rooms are kept alive
}
