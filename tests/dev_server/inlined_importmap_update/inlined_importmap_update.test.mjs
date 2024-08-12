/*
 * Test the following:
 * - importmap resolution applies correctly from a file
 * - updating importmap trigger autoreload + correctly update resolution
 */

import { assert } from "@jsenv/assert";
import { startDevServer } from "@jsenv/core";
import { replaceFileStructureSync, replaceFileSync } from "@jsenv/filesystem";
import { chromium } from "playwright";

if (process.env.CI) {
  process.exit(0);
}

const sourceDirectoryUrl = new URL("./git_ignored/", import.meta.url);
replaceFileStructureSync({
  from: new URL("./fixtures/0_at_start/", import.meta.url),
  to: sourceDirectoryUrl,
});
const devServer = await startDevServer({
  logLevel: "warn",
  serverLogLevel: "warn",
  sourceDirectoryUrl,
  keepProcessAlive: false,
  port: 0,
  ribbon: false,
  supervisor: false,
  clientAutoreload: false,
});
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ ignoreHTTPSErrors: true });
const getWindowAnswer = () => {
  return page.evaluate(
    /* eslint-disable no-undef */
    () => window.answer,
    /* eslint-enable no-undef */
  );
};

try {
  await page.goto(`${devServer.origin}/main.html`);
  const atStart = await getWindowAnswer();
  replaceFileSync({
    from: new URL(
      "./fixtures/1_redirect_a_to_b/main.importmap",
      import.meta.url,
    ),
    to: new URL("./git_ignored/main.importmap", import.meta.url),
  });
  await new Promise((resolve) => setTimeout(resolve, 400));
  await page.reload();
  const afterRedirect = await getWindowAnswer();
  replaceFileSync({
    from: new URL("./fixtures/0_at_start/main.importmap", import.meta.url),
    to: new URL("./git_ignored/main.importmap", import.meta.url),
  });
  await new Promise((resolve) => setTimeout(resolve, 400));
  await page.reload();
  const afterRestore = await getWindowAnswer();
  assert({
    actual: {
      atStart,
      afterRedirect,
      afterRestore,
    },
    expect: {
      atStart: 42,
      afterRedirect: "b",
      afterRestore: 42,
    },
  });
} finally {
  browser.close();
  devServer.stop(); // required because for some reason the rooms are kept alive
}
