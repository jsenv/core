/*
 * Ensures a dependency declared in package.json but absent from node_modules is
 * reported clearly, and that the browser reloads by itself and uses the package
 * once "npm install" puts it in node_modules.
 *
 * node_modules is not watched, so what tells the dev server the install is over
 * is the declared dependency becoming resolvable.
 */

import { replaceFileStructureSync, writeFileSync } from "@jsenv/filesystem";
import { snapshotTests } from "@jsenv/snapshot";
import { chromium } from "playwright";

import { startDevServer } from "@jsenv/core";
import { launchBrowserPage } from "@jsenv/core/tests/launch_browser_page.js";
import { waitForAnswer } from "@jsenv/core/tests/dev_server/wait_for_answer.js";

const debug = false; // true to have browser UI + keep it open after test
const sourceDirectoryUrl = new URL("./git_ignored/", import.meta.url);

const run = async () => {
  replaceFileStructureSync({
    from: new URL("./fixtures/project/", import.meta.url),
    to: sourceDirectoryUrl,
  });
  const devServer = await startDevServer({
    logLevel: "off",
    serverLogLevel: "off",
    sourceDirectoryUrl: new URL("./src/", sourceDirectoryUrl),
    keepProcessAlive: false,
    supervisor: { errorBaseUrl: "file:///" },
    ribbon: false,
    port: 0,
  });
  const browser = await chromium.launch({ headless: !debug });
  const page = await launchBrowserPage(browser, { pageErrorEffect: "none" });
  try {
    await page.setViewportSize({ width: 900, height: 550 });
    await page.goto(`${devServer.origin}/main.html`);

    not_installed: {
      await page.waitForSelector("jsenv-error-overlay", { timeout: 5_000 });
      // let the client fetch error details from the server
      await new Promise((resolve) => setTimeout(resolve, 200));
      writeFileSync(
        new URL("./output/error_overlay.html", import.meta.url),
        await page.evaluate(
          /* eslint-disable no-undef */
          () =>
            document
              .querySelector("jsenv-error-overlay")
              .shadowRoot.querySelector(".overlay").outerHTML,
          /* eslint-enable no-undef */
        ),
      );
      writeFileSync(
        new URL("./output/error_overlay.png", import.meta.url),
        await page.locator("jsenv-error-overlay").screenshot(),
      );
    }

    npm_install: {
      replaceFileStructureSync({
        from: new URL("./fixtures/foo_1.0.0/", import.meta.url),
        to: new URL("./node_modules/foo/", sourceDirectoryUrl),
      });
      // no reload is performed by the test: the page must come back on its own
      await waitForAnswer(page, 42);
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
