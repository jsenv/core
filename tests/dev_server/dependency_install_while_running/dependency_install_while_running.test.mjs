/*
 * Ensures a page keeps running a single copy of a package when "npm install"
 * changes that package while the dev server is running, and that a page left
 * alone during a dev server restart of several seconds comes back once the
 * server is up.
 *
 * node_modules is not watched, and package.json declares a range: what tells
 * the dev server about the install is the version the page was served moving
 * under it. The page must come back on its own, and a hot reload of main.js
 * after that must not bring a second copy of the package (the "?v=" of the
 * re-resolved import naming a version the page never evaluated).
 *
 * The screenshots in ./output/ show what the user sees at each step.
 */

import { assert } from "@jsenv/assert";
import { replaceFileStructureSync, writeFileSync } from "@jsenv/filesystem";
import { snapshotTests } from "@jsenv/snapshot";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

import { startDevServer } from "@jsenv/core";
import { waitForAnswer } from "@jsenv/core/tests/dev_server/wait_for_answer.js";

const debug = false; // true to have browser UI + keep it open after test
const sourceDirectoryUrl = new URL("./git_ignored/", import.meta.url);
const mainJsFileUrl = new URL("./src/main.js", sourceDirectoryUrl);

const npmInstall = (version) => {
  replaceFileStructureSync({
    from: new URL(`./fixtures/dep_${version}/`, import.meta.url),
    to: new URL("./node_modules/dep/", sourceDirectoryUrl),
  });
};
const startServer = (params) => {
  return startDevServer({
    logLevel: "off",
    serverLogLevel: "off",
    sourceDirectoryUrl: new URL("./src/", sourceDirectoryUrl),
    keepProcessAlive: false,
    ribbon: false,
    port: 0,
    ...params,
  });
};
const openBrowser = async () => {
  replaceFileStructureSync({
    from: new URL("./fixtures/project/", import.meta.url),
    to: sourceDirectoryUrl,
  });
  npmInstall("1.0.0");
  const browser = await chromium.launch({ headless: !debug });
  const page = await browser.newPage();
  page.on("pageerror", (error) => {
    throw error;
  });
  page.on("console", (message) => {
    if (message.type() !== "error") {
      return;
    }
    // the browser reports every connection attempt refused while the server is
    // down, and how many there are depends on timing
    if (message.text().includes("net::ERR_CONNECTION_REFUSED")) {
      return;
    }
    console.error(`chromium console.error > ${message.text()}`);
  });
  await page.setViewportSize({ width: 700, height: 400 });
  return { browser, page };
};
const closeBrowser = async ({ browser, page }) => {
  if (debug) {
    return;
  }
  await page.close();
  await browser.close();
};
const screenshot = async (page, name) => {
  writeFileSync(
    new URL(`./output/${name}`, import.meta.url),
    await page.screenshot(),
  );
};
const readPageState = (page) => {
  return page.evaluate(
    /* eslint-disable no-undef */
    () => {
      const resourceUrls = performance
        .getEntriesByType("resource")
        .map((resourceEntry) => resourceEntry.name);
      return {
        depVersion: window.answer,
        depInstances: window.depInstances,
        mainRuns: window.mainRuns,
        depUrls: Array.from(
          new Set(
            resourceUrls
              .filter((url) => url.includes("/node_modules/"))
              .map((url) => url.slice(url.indexOf("/node_modules/"))),
          ),
        ).sort(),
      };
    },
    /* eslint-enable no-undef */
  );
};

const installWhileRunning = async () => {
  const { browser, page } = await openBrowser();
  const devServer = await startServer();
  try {
    await page.goto(`${devServer.origin}/main.html`);
    await waitForAnswer(page, "1.0.0");
    await screenshot(page, "0_page_loaded.png");

    install: {
      npmInstall("2.0.0");
      // no reload is performed by the test: the page must come back on its own
      await waitForAnswer(page, "2.0.0");
      await screenshot(page, "1_after_install.png");
      const actual = await readPageState(page);
      const expect = {
        depVersion: "2.0.0",
        depInstances: ["2.0.0"],
        mainRuns: 1,
        depUrls: ["/node_modules/dep/index.js?v=2.0.0"],
      };
      assert({ actual, expect });
    }

    hot_reload_after_install: {
      // editing main.js re-resolves its imports: they must land on the copy of
      // the package the page already runs
      writeFileSync(
        mainJsFileUrl,
        `${readFileSync(mainJsFileUrl, "utf8")}\n// edited while running\n`,
      );
      await page.waitForFunction(
        /* eslint-disable no-undef */
        () => window.mainRuns === 2,
        /* eslint-enable no-undef */
        null,
        { timeout: 10_000 },
      );
      await screenshot(page, "2_after_hot_reload.png");
      const actual = await readPageState(page);
      const expect = {
        depVersion: "2.0.0",
        depInstances: ["2.0.0"],
        mainRuns: 2,
        depUrls: ["/node_modules/dep/index.js?v=2.0.0"],
      };
      assert({ actual, expect });
    }
  } finally {
    await closeBrowser({ browser, page });
    devServer.stop();
  }
};

const serverRestart = async () => {
  const { browser, page } = await openBrowser();
  let devServer = await startServer();
  try {
    await page.goto(`${devServer.origin}/main.html`);
    await waitForAnswer(page, "1.0.0");
    await page.evaluate(
      /* eslint-disable no-undef */
      () => {
        window.beforeRestart = true;
      },
      /* eslint-enable no-undef */
    );
    const { port } = new URL(devServer.origin);

    server_down: {
      await devServer.stop();
      await page.waitForFunction(
        /* eslint-disable no-undef */
        () =>
          document
            .querySelector("jsenv-autoreload-on-server-restart")
            .shadowRoot.querySelector("dialog").open,
        /* eslint-enable no-undef */
        null,
        { timeout: 10_000 },
      );
      await screenshot(page, "0_server_down.png");
      writeFileSync(
        new URL("./output/0_server_down.html", import.meta.url),
        await page.evaluate(
          /* eslint-disable no-undef */
          () =>
            document
              .querySelector("jsenv-autoreload-on-server-restart")
              .shadowRoot.querySelector("dialog").outerHTML,
          /* eslint-enable no-undef */
        ),
      );
    }

    server_back: {
      // the server stays down for a while: the page must keep waiting for it
      await new Promise((resolve) => {
        setTimeout(resolve, 5_000);
      });
      devServer = await startServer({ port });
      // the tab regaining focus is one of the moments the page tries again
      // right away rather than waiting out its backoff
      await page.evaluate(
        /* eslint-disable no-undef */
        () => {
          window.dispatchEvent(new Event("focus"));
        },
        /* eslint-enable no-undef */
      );
      await page.waitForFunction(
        /* eslint-disable no-undef */
        () => window.beforeRestart === undefined && window.answer === "1.0.0",
        /* eslint-enable no-undef */
        null,
        { timeout: 10_000 },
      );
      await screenshot(page, "1_server_back.png");
    }
  } finally {
    await closeBrowser({ browser, page });
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
  test("0_install_while_running", () => installWhileRunning());
  test("1_server_restart", () => serverRestart());
});
