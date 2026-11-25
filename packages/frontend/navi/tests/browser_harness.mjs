/*
 * What every browser suite of navi shares: the dev server, the engines, the
 * page and what it reports. A problem of the harness is fixed here once — the
 * dependency overlay that takes every press, the engine a suite runs in.
 *
 * Engines: chromium and webkit, each test once per engine, its snapshot
 * named after it. `NAVI_TEST_ENGINES=chromium` (a comma separated list) narrows
 * a run. A case that needs what one engine alone has (CDP's touch emulation,
 * a heap snapshot) says so with `engines`.
 *
 * Waiting: an absence is read once navi says it is at rest, never after a
 * fixed sleep — `whenPageAtRest` (a page exposing it as `window.whenPageAtRest`)
 * for a navigation, the frames a list needs for its own. A timeout stays only
 * as the bound on failure.
 */

import { startDevServer } from "@jsenv/core";
import { jsenvPluginPreact } from "@jsenv/plugin-preact";
import { snapshotTests } from "@jsenv/snapshot";
import * as playwright from "playwright";

export const ENGINES = (process.env.NAVI_TEST_ENGINES || "chromium,webkit")
  .split(",")
  .map((engine) => engine.trim())
  .filter(Boolean);

export const startNaviDevServer = ({ plugins = [] } = {}) =>
  startDevServer({
    logLevel: "off",
    serverLogLevel: "off",
    sourceDirectoryUrl: new URL("../", import.meta.url),
    keepProcessAlive: false,
    clientAutoreload: false,
    http2: false,
    port: 0,
    // It covers the page and takes its presses when a workspace package is
    // bumped before its dependents: a false red that says nothing about navi.
    dependencyStatus: false,
    plugins: [jsenvPluginPreact(), ...plugins],
  });

// The dev server fills its own cache directory while cooking the pages; those
// files are not what a suite is about.
export const configureBrowserSnapshots = () => {
  snapshotTests.prefConfigure({
    filesystemActions: {
      "**/.jsenv/": "ignore",
    },
  });
};

/**
 * Declares `test` once per engine, the engine's browser launched once for all
 * the tests of the suite and closed with it.
 *
 * @param {Function} test - snapshotTests' `test`
 * @param {string} name
 * @param {(context: { browser, engine }) => Promise<any>} fn
 * @param {{ engines?: string[] }} [options]
 */
export const createEngineTests = () => {
  const browserByEngine = new Map();
  const browserOf = async (engine) => {
    let browser = browserByEngine.get(engine);
    if (!browser) {
      browser = playwright[engine].launch({ headless: true });
      browserByEngine.set(engine, browser);
    }
    return browser;
  };
  const testInEngines = (test, name, fn, { engines = ENGINES } = {}) => {
    for (const engine of ENGINES) {
      if (!engines.includes(engine)) {
        continue;
      }
      test(`${name} (${engine})`, async () => {
        const browser = await browserOf(engine);
        return fn({ browser, engine });
      });
    }
  };
  const closeBrowsers = async () => {
    for (const browser of browserByEngine.values()) {
      await (await browser).close();
    }
    browserByEngine.clear();
  };
  return { testInEngines, browserOf, closeBrowsers };
};

/**
 * A page that keeps what went wrong in it: uncaught errors, unhandled
 * rejections (which only an init script hears), and the console's errors and
 * warnings.
 */
export const openPage = async (browser, url, pageOptions = {}) => {
  const { gotoOptions, ...contextOptions } = pageOptions;
  const page = await browser.newPage(contextOptions);
  const errors = [];
  const warnings = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    const type = message.type();
    if (type === "error") {
      errors.push(message.text());
    } else if (type === "warning") {
      warnings.push(message.text());
    }
  });
  await page.addInitScript(() => {
    /* eslint-disable no-undef */
    window.addEventListener("unhandledrejection", (event) => {
      const reason = event.reason;
      console.error(
        `unhandled rejection: ${reason && reason.message ? reason.message : String(reason)}`,
      );
    });
    /* eslint-enable no-undef */
  });
  if (url) {
    // The run's budget ("jsenv:allocate") is the limit: under a full test run
    // the first load, which cooks all of navi, outlasts Playwright's 30s.
    await page.goto(url, { timeout: 0, ...gotoOptions });
    await whenDocumentExecuted(page);
  }
  return { page, errors, warnings };
};

/**
 * The document's scripts executed: the page's module and everything it
 * imports evaluated, its first render done. To be awaited after every
 * `goto` and `reload`.
 *
 * The load event does not say it in WebKit: the dev server's supervisor runs
 * a module script there through a dynamic import, which the load event does
 * not wait for. The cooking of navi then happens after `goto` resolved — a
 * timeout or a fixed wait started at `goto` is spent on it, and on a loaded
 * machine runs out before the app has run. No timeout: the run's budget
 * ("jsenv:allocate") is the limit, as for `goto`.
 */
export const whenDocumentExecuted = (page) =>
  page.evaluate(async () => {
    /* eslint-disable no-undef */
    if (!window.__supervisor__) {
      throw new Error("window.__supervisor__ is undefined");
    }
    await window.__supervisor__.getDocumentExecutionResult();
    /* eslint-enable no-undef */
  });

// Frames, for what a list settles over: its window, the resizes a commit
// delivers, the commits those cause.
export const waitFrames = (page, count = 10) =>
  page.evaluate(
    (frames) =>
      new Promise((resolve) => {
        let left = frames;
        const step = () => {
          left--;
          if (left <= 0) {
            resolve();
            return;
          }
          requestAnimationFrame(step); // eslint-disable-line no-undef
        };
        requestAnimationFrame(step); // eslint-disable-line no-undef
      }),
    count,
  );

// The page at rest: no route action asking for it, no route transition
// playing, and a frame painted after both (see navi's whenPageAtRest, which
// the page exposes as window.whenPageAtRest). The page's module runs after the
// load event (the dev server's supervisor imports it): it is waited for first,
// a minute at most — a page that left the document never brings it.
export const whenPageAtRest = async (page, { timeout = 10000 } = {}) => {
  await page.waitForFunction(
    // eslint-disable-next-line no-undef
    () => typeof window.whenPageAtRest === "function",
    null,
    { timeout: 60000 },
  );
  await page.evaluate(
    (ms) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`page not at rest after ${ms}ms`)),
          ms,
        );
        // eslint-disable-next-line no-undef
        window.whenPageAtRest(() => {
          clearTimeout(timer);
          resolve();
        });
      }),
    timeout,
  );
};
