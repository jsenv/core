/*
 * Ensures a dependency installed at an other version than the one declared in
 * package.json keeps working (the installed version is used), says so through
 * the warning overlay, and that the browser reloads by itself and uses the new
 * version once "npm install" brings node_modules in line with package.json.
 *
 * node_modules is not watched, so what tells the dev server the install is over
 * is the installed version becoming the declared one.
 *
 * main.js imports two packages, and only one of them moves: a file depends on
 * one package.json per package it imports, and a version bump must be seen
 * whichever of them was resolved first.
 */

import { assert } from "@jsenv/assert";
import { replaceFileStructureSync, writeFileSync } from "@jsenv/filesystem";
import { snapshotTests } from "@jsenv/snapshot";
import { chromium } from "playwright";

import { startDevServer } from "@jsenv/core";
import { waitForAnswer } from "@jsenv/core/tests/dev_server/wait_for_answer.js";
import { launchBrowserPage } from "@jsenv/core/tests/launch_browser_page.js";

const debug = false; // true to have browser UI + keep it open after test
const sourceDirectoryUrl = new URL("./git_ignored/", import.meta.url);

const run = async () => {
  replaceFileStructureSync({
    from: new URL("./fixtures/project/", import.meta.url),
    to: sourceDirectoryUrl,
  });
  // package.json declares 1.0.1, node_modules holds 1.0.0
  replaceFileStructureSync({
    from: new URL("./fixtures/foo_1.0.0/", import.meta.url),
    to: new URL("./node_modules/foo/", sourceDirectoryUrl),
  });
  // bar is installed at the version package.json asks for: it is there to be
  // the OTHER package main.js imports, so that foo's version is tracked next
  // to a package whose version never moves
  replaceFileStructureSync({
    from: new URL("./fixtures/bar/", import.meta.url),
    to: new URL("./node_modules/bar/", sourceDirectoryUrl),
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
  const page = await launchBrowserPage(browser);
  try {
    await page.setViewportSize({ width: 900, height: 550 });
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

    warning_overlay: {
      await page.waitForSelector("jsenv-warning-overlay", { timeout: 5_000 });
      writeFileSync(
        new URL("./output/warning_overlay.html", import.meta.url),
        await page.evaluate(
          /* eslint-disable no-undef */
          () =>
            document
              .querySelector("jsenv-warning-overlay")
              .shadowRoot.querySelector(".overlay").outerHTML,
          /* eslint-enable no-undef */
        ),
      );
      writeFileSync(
        new URL("./output/warning_overlay.png", import.meta.url),
        await page.locator("jsenv-warning-overlay").screenshot(),
      );
    }

    copy_button: {
      await page
        .context()
        .grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.evaluate(
        /* eslint-disable no-undef */
        () =>
          document
            .querySelector("jsenv-warning-overlay")
            .shadowRoot.querySelector(".copy")
            .click(),
        /* eslint-enable no-undef */
      );
      await page.waitForFunction(
        /* eslint-disable no-undef */
        () =>
          document
            .querySelector("jsenv-warning-overlay")
            .shadowRoot.querySelector(".copy").textContent === "Copied",
        /* eslint-enable no-undef */
        null,
        { timeout: 5_000 },
      );
      const clipboardText = await page.evaluate(
        /* eslint-disable no-undef */
        () => window.navigator.clipboard.readText(),
        /* eslint-enable no-undef */
      );
      writeFileSync(
        new URL("./output/copied.md", import.meta.url),
        clipboardText,
      );
    }

    npm_install: {
      replaceFileStructureSync({
        from: new URL("./fixtures/foo_1.0.1/", import.meta.url),
        to: new URL("./node_modules/foo/", sourceDirectoryUrl),
      });
      // no reload is performed by the test: the page must come back on its own
      await waitForAnswer(page, 43);
    }

    versions_match: {
      writeFileSync(
        new URL("./output/page_after_install.png", import.meta.url),
        await page.screenshot(),
      );
      const actual = {
        answer: await page.evaluate(
          /* eslint-disable no-undef */
          () => window.answer,
          /* eslint-enable no-undef */
        ),
        rendered: await page.locator("#app").textContent(),
        warningOverlay: await page.evaluate(
          /* eslint-disable no-undef */
          () => Boolean(document.querySelector("jsenv-warning-overlay")),
          /* eslint-enable no-undef */
        ),
      };
      const expect = {
        answer: 43,
        rendered: "43",
        warningOverlay: false,
      };
      assert({ actual, expect });
    }

    every_package_is_loaded_from_its_installed_version: {
      // The value alone cannot tell whether the reload was enough: the files
      // behind an outdated "?v=" are re-read from disk and answer 43 too. What
      // must have moved is the "?v=" main.js was cooked with — a specifier
      // still naming 1.0.0 is a second copy of foo, living under a url nothing
      // else resolves to.
      const resourceUrls = await page.evaluate(() =>
        performance
          .getEntriesByType("resource")
          .map((resourceEntry) => resourceEntry.name),
      );
      const actual = Array.from(
        new Set(
          resourceUrls
            .filter((url) => url.includes("/node_modules/"))
            .map((url) => url.slice(url.indexOf("/node_modules/"))),
        ),
      ).sort();
      const expect = [
        "/node_modules/bar/index.js?v=1.0.0",
        "/node_modules/foo/answer.js?v=1.0.1",
        "/node_modules/foo/index.js?v=1.0.1",
      ];
      assert({ actual, expect });
    }
  } finally {
    if (!debug) {
      await page.close();
      await browser.close();
    }
    devServer.stop();
  }
};

snapshotTests.prefConfigure({
  filesystemActions: {
    "**/.jsenv/": "ignore",
    "**/git_ignored/": "ignore",
    "**/*.png": "compare_presence_only",
  },
});
await snapshotTests(import.meta.url, ({ test }) => {
  test("0_install_while_running", () => run());
});
