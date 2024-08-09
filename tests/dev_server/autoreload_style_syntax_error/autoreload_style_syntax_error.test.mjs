/*
 * Test the following:
 * - <style> can hot reload
 * - Introducing a syntax error removes background color
 * - Fixing syntax error restore background color
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
});

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ ignoreHTTPSErrors: true });

try {
  await page.goto(`${devServer.origin}/main.html`);
  const getDocumentBodyBackgroundColor = () => {
    return page.evaluate(
      /* eslint-disable no-undef */
      () => window.getComputedStyle(document.body).backgroundColor,
      /* eslint-enable no-undef */
    );
  };
  const atStart = await getDocumentBodyBackgroundColor();
  const pageReloadPromise = page.waitForNavigation();
  replaceFileStructureSync({
    from: new URL("./fixtures/1_syntax_error/", import.meta.url),
    to: sourceDirectoryUrl,
  });
  await pageReloadPromise;
  const afterSyntaxError = await getDocumentBodyBackgroundColor();
  replaceFileStructureSync({
    from: new URL("./fixtures/0_at_start/", import.meta.url),
    to: sourceDirectoryUrl,
  });
  await new Promise((resolve) => setTimeout(resolve, 500));
  const afterRestore = await getDocumentBodyBackgroundColor();
  assert({
    actual: {
      atStart,
      afterSyntaxError,
      afterRestore,
    },
    expect: {
      atStart: `rgb(255, 0, 0)`,
      afterSyntaxError: `rgba(0, 0, 0, 0)`,

      afterRestore: `rgb(255, 0, 0)`,
    },
  });
} finally {
  browser.close();
  devServer.stop(); // required because for some reason the rooms are kept alive
}
