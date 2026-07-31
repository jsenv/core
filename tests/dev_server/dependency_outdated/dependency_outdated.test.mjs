/*
 * Ensures a dependency installed at an other version than the one declared in
 * package.json keeps working (the installed version is used), and that the
 * browser reloads by itself and uses the new version once "npm install" brings
 * node_modules in line with package.json.
 *
 * node_modules is not watched, so what tells the dev server the install is over
 * is the installed version becoming the declared one.
 */

import { assert } from "@jsenv/assert";
import { replaceFileStructureSync } from "@jsenv/filesystem";
import { chromium } from "playwright";

import { startDevServer } from "@jsenv/core";
import { launchBrowserPage } from "@jsenv/core/tests/launch_browser_page.js";
import { waitForAnswer } from "@jsenv/core/tests/dev_server/wait_for_answer.js";

const debug = false; // true to have browser UI + keep it open after test
const sourceDirectoryUrl = new URL("./git_ignored/", import.meta.url);

replaceFileStructureSync({
  from: new URL("./fixtures/project/", import.meta.url),
  to: sourceDirectoryUrl,
});
// package.json declares 1.0.1, node_modules holds 1.0.0
replaceFileStructureSync({
  from: new URL("./fixtures/foo_1.0.0/", import.meta.url),
  to: new URL("./node_modules/foo/", sourceDirectoryUrl),
});

const devServer = await startDevServer({
  logLevel: "off",
  serverLogLevel: "off",
  sourceDirectoryUrl: new URL("./src/", sourceDirectoryUrl),
  keepProcessAlive: false,
  ribbon: false,
  port: 0,
});
const browser = await chromium.launch({ headless: !debug });
try {
  const page = await launchBrowserPage(browser);
  await page.goto(`${devServer.origin}/main.html`);

  outdated_version_is_used: {
    const actual = await page.evaluate(
      /* eslint-disable no-undef */
      () => window.answer,
      /* eslint-enable no-undef */
    );
    const expect = 42;
    assert({ actual, expect });
  }

  npm_install: {
    replaceFileStructureSync({
      from: new URL("./fixtures/foo_1.0.1/", import.meta.url),
      to: new URL("./node_modules/foo/", sourceDirectoryUrl),
    });
    // no reload is performed by the test: the page must come back on its own
    await waitForAnswer(page, 43);
  }
} finally {
  if (!debug) {
    browser.close();
  }
}
