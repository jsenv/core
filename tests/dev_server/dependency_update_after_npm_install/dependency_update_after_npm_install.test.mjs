/*
 * Ensures that when "npm install" brings a new version of a dependency while
 * the dev server is running, reloading the browser uses that new version.
 *
 * node_modules is not watched, so nothing reloads the browser on its own; it is
 * the request following the reload that must see the new package version and
 * serve the files behind it, instead of the ones cached under the previous
 * version.
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

import { assert } from "@jsenv/assert";
import { replaceFileStructureSync } from "@jsenv/filesystem";
import { chromium } from "playwright";

import { startDevServer } from "@jsenv/core";
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
  const getResult = () => {
    return page.evaluate(
      /* eslint-disable no-undef */
      () => window.resultPromise,
      /* eslint-enable no-undef */
    );
  };

  external_js_module: {
    await page.goto(`${devServer.origin}/main.html`);
    {
      const actual = await getResult();
      const expect = 42;
      assert({ actual, expect });
    }
    npmInstall("foo_1.0.1");
    await page.reload();
    {
      const actual = await getResult();
      const expect = 43;
      assert({ actual, expect });
    }
  }

  inline_js_module: {
    await page.goto(`${devServer.origin}/inline.html`);
    {
      const actual = await getResult();
      const expect = 42;
      assert({ actual, expect });
    }
    npmInstall("bar_1.0.1");
    await page.reload();
    {
      const actual = await getResult();
      const expect = 43;
      assert({ actual, expect });
    }
  }
} finally {
  if (!debug) {
    browser.close();
  }
}
