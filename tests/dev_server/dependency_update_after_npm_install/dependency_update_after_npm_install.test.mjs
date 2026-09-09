/*
 * Ensures that when "npm install" brings a new version of a dependency while
 * the dev server is running, the browser comes back on its own with that new
 * version: the request following the reload must see the new package version
 * and serve the files behind it, instead of the ones cached under the previous
 * version.
 *
 * package.json declares "*" for both packages, so what tells the dev server
 * about the install is the served version moving, not a declared version
 * being satisfied.
 *
 * Both ways of importing the package are covered because they are cached
 * differently: "main.html" imports it from an external js module, "inline.html"
 * from an inline js module (an inline js module is served under the etag of the
 * html containing it, and that html is untouched when only the resolution of
 * one of its imports changes).
 *
 * Each html uses its own package so that one scenario cannot warm up the
 * browser cache for the other.
 */

import { replaceFileStructureSync } from "@jsenv/filesystem";
import { chromium } from "playwright";

import { startDevServer } from "@jsenv/core";
import { waitForAnswer } from "@jsenv/core/tests/dev_server/wait_for_answer.js";
import { launchBrowserPage } from "@jsenv/core/tests/launch_browser_page.js";

const debug = false; // true to have browser UI + keep it open after test
const sourceDirectoryUrl = new URL("./git_ignored/", import.meta.url);
const npmInstall = (packageFixtureName) => {
  const packageName = packageFixtureName.slice(
    0,
    packageFixtureName.indexOf("_"),
  );
  replaceFileStructureSync({
    from: new URL(`./fixtures/${packageFixtureName}/`, import.meta.url),
    to: new URL(`./node_modules/${packageName}/`, sourceDirectoryUrl),
  });
};

replaceFileStructureSync({
  from: new URL("./fixtures/project/", import.meta.url),
  to: sourceDirectoryUrl,
});
npmInstall("foo_1.0.0");
npmInstall("bar_1.0.0");

const devServer = await startDevServer({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./src/", sourceDirectoryUrl),
  keepProcessAlive: false,
  port: 0,
});
const browser = await chromium.launch({ headless: !debug });
try {
  const page = await launchBrowserPage(browser);

  external_js_module: {
    await page.goto(`${devServer.origin}/main.html`);
    await waitForAnswer(page, 42);
    npmInstall("foo_1.0.1");
    // no reload is performed by the test: the page must come back on its own
    await waitForAnswer(page, 43);
  }

  inline_js_module: {
    await page.goto(`${devServer.origin}/inline.html`);
    await waitForAnswer(page, 42);
    npmInstall("bar_1.0.1");
    await waitForAnswer(page, 43);
  }
} finally {
  if (!debug) {
    browser.close();
  }
}
